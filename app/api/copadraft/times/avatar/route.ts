import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { createMainConnection } from "@/lib/db";
import { getPlayerTeamSlot, isPlayerInTeam } from "@/lib/copadraft-team-access";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AVATAR_COLUMNS = ["avatar0", "avatar1", "avatar2", "avatar3", "avatar4"] as const;
const PHOTO_DIR = path.join(process.cwd(), "public", "fotostime");
type AvatarFilterMode = "none" | "remove-white" | "white-bg";
const AVATAR_ERROR_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1503419113056505977/2jdHJf2aOk6oia6FmB0Sn_q3e1HAYoNIHU9CaI7l9se1vVLCj4P0QwXVUy0Ug743G7fE";

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function slugify(value: unknown) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFileStem(value: string) {
  const stem = String(value || "")
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return stem || "avatar";
}

function sanitizeImageName(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const basename = path.basename(raw);
  if (basename.includes("..") || basename.includes("/") || basename.includes("\\")) return "";

  return /\.(png|jpe?g|webp)$/i.test(basename) ? basename : "";
}

async function resolveBestTeamDir(baseDir: string, teamName: string) {
  const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((entry) => entry.isDirectory());
  if (!dirs.length) return null;

  const rawName = String(teamName || "").trim();
  const teamSlug = slugify(teamName);
  const wantedNorm = normalizeText(teamName);

  const exactRaw = dirs.find((entry) => entry.name === rawName);
  if (exactRaw) return path.join(baseDir, exactRaw.name);

  const exactSlug = dirs.find((entry) => entry.name === teamSlug);
  if (exactSlug) return path.join(baseDir, exactSlug.name);

  const rawLower = rawName.toLowerCase();
  const slugLower = teamSlug.toLowerCase();
  const ci = dirs.find((entry) => {
    const entryLower = entry.name.toLowerCase();
    return entryLower === rawLower || entryLower === slugLower;
  });
  if (ci) return path.join(baseDir, ci.name);

  const normalized = dirs.find((entry) => {
    const entryName = String(entry.name || "");
    return normalizeText(entryName) === wantedNorm || slugify(entryName) === teamSlug;
  });

  return normalized ? path.join(baseDir, normalized.name) : null;
}

function extFromMimeType(mimeType: string) {
  if (mimeType.includes("image/png")) return ".png";
  if (mimeType.includes("image/webp")) return ".webp";
  if (mimeType.includes("image/jpeg")) return ".jpg";
  if (mimeType.includes("image/jpg")) return ".jpg";
  return ".jpg";
}

function extFromFilename(filename: string) {
  const ext = path.extname(String(filename || "")).trim().toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return "";
}

function decodeBase64Image(fileBase64: string) {
  const raw = String(fileBase64 || "").trim();
  if (!raw) return null;

  const dataUrlMatch = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    const mimeType = String(dataUrlMatch[1] || "").toLowerCase();
    const base64 = String(dataUrlMatch[2] || "");
    return {
      bytes: Buffer.from(base64, "base64"),
      mimeType,
    };
  }

  return {
    bytes: Buffer.from(raw, "base64"),
    mimeType: "image/jpeg",
  };
}

async function removeBackgroundWithSlazzer(inputBytes: Buffer, filename: string, mimeType: string) {
  const apiKey = String(process.env.KEY_REMOVEBG || "").trim();
  if (!apiKey) {
    throw new Error("Chave do Slazzer nao configurada.");
  }

  const formData = new FormData();
  formData.append(
    "source_image_file",
    new Blob([new Uint8Array(inputBytes)], { type: mimeType || "image/jpeg" }),
    filename || "image.jpg"
  );
  formData.append("format", "png");
  formData.append("crop", "true");

  const response = await fetch("https://api.slazzer.com/v2.0/remove_image_background", {
    method: "POST",
    headers: {
      "API-KEY": apiKey,
    },
    body: formData,
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());

  if (!response.ok) {
    const errorText = contentType.includes("application/json") || contentType.includes("text/")
      ? buffer.toString("utf8")
      : "";
    throw new Error(errorText || `Erro no Slazzer (${response.status}).`);
  }

  if (!buffer.length) {
    throw new Error("Slazzer retornou imagem vazia.");
  }

  return {
    bytes: buffer,
    mimeType: contentType.includes("image/") ? contentType.split(";")[0] : "image/png",
  };
}

async function isAdminOne(connection: any, faceitGuid: string) {
  const [rows] = await connection.query(
    "SELECT Admin FROM players WHERE faceit_guid = ? LIMIT 1",
    [faceitGuid]
  );

  const row = Array.isArray(rows) ? (rows as Array<{ Admin: number | string | null }>)[0] : null;
  if (!row) return false;

  return Number(row.Admin) === 1;
}

async function clearExistingSlotFiles(dir: string, slot: number) {
  const files = await readdir(dir).catch(() => [] as string[]);
  const slotPattern = new RegExp(`^${slot}(bg)?\\.(png|jpe?g|webp)$`, "i");

  await Promise.all(
    files
      .filter((name) => slotPattern.test(String(name || "")))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined))
  );
}

async function resolveSelectedImagePath(teamDir: string, filename: string) {
  const safeName = sanitizeImageName(filename);
  if (!safeName) return null;

  const absolutePath = path.join(teamDir, safeName);
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) return null;
    return safeName;
  } catch {
    const entries = await readdir(teamDir, { withFileTypes: true }).catch(() => []);
    const wanted = safeName.toLowerCase();
    const found = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === wanted);
    return found?.name || null;
  }
}

async function notifyAvatarSaveError(details: {
  faceitGuid: string;
  nickname: string;
  steamId: string;
  errorMessage: string;
}) {
  const faceitGuid = String(details.faceitGuid || "").trim() || "(vazio)";
  const nickname = String(details.nickname || "").trim() || "(vazio)";
  const steamId = String(details.steamId || "").trim() || "(vazio)";
  const errorMessage = String(details.errorMessage || "Erro desconhecido").trim();

  const content = [
    "[COPADRAFT] Erro ao salvar foto no editar time",
    `faceit_guid: ${faceitGuid}`,
    `nickname: ${nickname}`,
    `steam: ${steamId}`,
    "erro:",
    errorMessage,
  ].join("\n");

  await fetch(AVATAR_ERROR_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: content.length > 1900 ? `${content.slice(0, 1900)}...` : content,
    }),
  });
}

export async function POST(request: Request) {
  let connection: any = null;
  let reporterFaceitGuid = "";
  let reporterNickname = "";
  let reporterSteamId = "";

  try {
    const payload = await request.json().catch(() => null);

    const faceitGuid = String(payload?.faceit_guid || "").trim();
    reporterFaceitGuid = faceitGuid;
    reporterNickname = String(payload?.nickname || "").trim();
    reporterSteamId = String(payload?.steam_id_64 || payload?.steam || "").trim();
    const teamName = String(payload?.time || "").trim();
    const playerGuid = String(payload?.player_faceit_guid || "").trim().toLowerCase();
    const filename = String(payload?.filename || "").trim();
    const fileBase64 = String(payload?.file_base64 || "").trim();
    const filterModeRaw = String(payload?.filter_mode || "none").trim().toLowerCase();
    const filterMode: AvatarFilterMode =
      filterModeRaw === "remove-white" || filterModeRaw === "white-bg" ? filterModeRaw : "none";

    if (!faceitGuid || !teamName) {
      return NextResponse.json({ message: "faceit_guid e time sao obrigatorios." }, { status: 400 });
    }

    const ownGuid = faceitGuid.toLowerCase();
    const targetGuid = String(playerGuid || ownGuid).trim().toLowerCase();
    const slot = getPlayerTeamSlot(targetGuid, teamName);
    if (slot === null) {
      return NextResponse.json({ message: "Jogador alvo nao encontrado no time." }, { status: 403 });
    }

    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const isAdmin = await isAdminOne(connection, ownGuid);
    if (!isAdmin && !isPlayerInTeam(ownGuid, teamName)) {
      return NextResponse.json({ message: "Somente membros do proprio time podem salvar avatar." }, { status: 403 });
    }

    if (!isAdmin && targetGuid !== ownGuid) {
      return NextResponse.json({ message: "Usuario nao admin so pode salvar a propria foto." }, { status: 403 });
    }

    const avatarColumn = AVATAR_COLUMNS[slot];
    const [existingRows] = await connection.query(
      `SELECT id, ${avatarColumn} AS avatarAtual FROM banner WHERE time = ? LIMIT 1`,
      [teamName]
    );
    const existing = Array.isArray(existingRows)
      ? (existingRows as Array<{ id: number | null; avatarAtual: string | null }>)[0]
      : null;

    if (!isAdmin) {
      const currentAvatar = String(existing?.avatarAtual || "").trim();
      if (currentAvatar) {
        return NextResponse.json(
          { message: "Voce ja escolheu sua foto. Agora somente Admin pode alterar." },
          { status: 403 }
        );
      }
    }

    const existingTeamDir = await resolveBestTeamDir(PHOTO_DIR, teamName);
    const teamDir = existingTeamDir || path.join(PHOTO_DIR, slugify(teamName) || "time");
    await mkdir(teamDir, { recursive: true });
    const publicTeamFolder = path.basename(teamDir);

    let publicPath = "";
    let fileName = "";

    if (filterMode === "none") {
      const resolvedName = await resolveSelectedImagePath(teamDir, filename);
      if (!resolvedName) {
        notifyAvatarSaveError({
          faceitGuid: reporterFaceitGuid,
          nickname: reporterNickname,
          steamId: reporterSteamId,
          errorMessage: `Arquivo nao encontrado na pasta do time.\nfilename: ${filename}\ntime: ${teamName}`,
        }).catch(() => {});
        return NextResponse.json({ message: "Imagem selecionada nao encontrada na pasta do time." }, { status: 400 });
      }

      fileName = resolvedName;
      publicPath = `/fotostime/${publicTeamFolder}/${resolvedName}`;
    } else {
      if (!fileBase64) {
        notifyAvatarSaveError({
          faceitGuid: reporterFaceitGuid,
          nickname: reporterNickname,
          steamId: reporterSteamId,
          errorMessage: `file_base64 vazio para modo ${filterMode}.\nfilename: ${filename}\ntime: ${teamName}`,
        }).catch(() => {});
        return NextResponse.json({ message: "Nenhuma imagem enviada." }, { status: 400 });
      }

      const decoded = decodeBase64Image(fileBase64);
      if (!decoded || !decoded.bytes.length) {
        notifyAvatarSaveError({
          faceitGuid: reporterFaceitGuid,
          nickname: reporterNickname,
          steamId: reporterSteamId,
          errorMessage: `Base64 invalido ou vazio.\nfilename: ${filename}\ntime: ${teamName}\nmode: ${filterMode}`,
        }).catch(() => {});
        return NextResponse.json({ message: "Imagem invalida." }, { status: 400 });
      }

      let bytes = decoded.bytes;
      let mimeType = decoded.mimeType;

      if (filterMode === "remove-white") {
        const removed = await removeBackgroundWithSlazzer(decoded.bytes, filename, mimeType);
        bytes = removed.bytes;
        mimeType = removed.mimeType;
      }

      if (!bytes.length || bytes.length > 12 * 1024 * 1024) {
        notifyAvatarSaveError({
          faceitGuid: reporterFaceitGuid,
          nickname: reporterNickname,
          steamId: reporterSteamId,
          errorMessage: `Imagem muito grande ou vazia apos processamento.\nbytes: ${bytes.length}\nfilename: ${filename}\ntime: ${teamName}`,
        }).catch(() => {});
        return NextResponse.json({ message: "Imagem muito grande ou vazia." }, { status: 400 });
      }

      const ext = filterMode === "remove-white" ? ".png" : extFromFilename(filename) || extFromMimeType(mimeType);
      const baseName = sanitizeFileStem(filename);
      const suffix = filterMode === "remove-white" ? "bg" : "edit";
      fileName = `${baseName}-${suffix}-${Date.now()}${ext}`;
      const absolutePath = path.join(teamDir, fileName);

      await clearExistingSlotFiles(teamDir, slot);
      await writeFile(absolutePath, bytes);
      publicPath = `/fotostime/${publicTeamFolder}/${fileName}`;
    }

    const versionedPublicPath = `${publicPath}?v=${Date.now()}`;
    if (existing?.id) {
      await connection.query(`UPDATE banner SET ${avatarColumn} = ? WHERE id = ?`, [publicPath, existing.id]);
    } else {
      await connection.query(
        `INSERT INTO banner (time, zoom, x, y, largura, altura, ordem, ${avatarColumn}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [teamName, 1, 0, 0, 1100, 280, "", publicPath]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Avatar salvo com sucesso.",
      slot,
      avatarPath: publicPath,
      avatarPathVersioned: versionedPublicPath,
      fileName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar avatar.";
    const fullError = error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error);

    try {
      await notifyAvatarSaveError({
        faceitGuid: reporterFaceitGuid,
        nickname: reporterNickname,
        steamId: reporterSteamId,
        errorMessage: fullError || message,
      });
    } catch {
      // Evita quebrar a resposta da API quando o webhook falhar
    }

    return NextResponse.json({ message }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}
