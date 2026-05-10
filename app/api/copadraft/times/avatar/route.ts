import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
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

export async function POST(request: Request) {
  let connection: any = null;

  try {
    const payload = await request.json().catch(() => null);

    const faceitGuid = String(payload?.faceit_guid || "").trim();
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

    if (!fileBase64) {
      return NextResponse.json({ message: "Nenhuma imagem enviada." }, { status: 400 });
    }

    const ownGuid = faceitGuid.toLowerCase();
    const targetGuid = String(playerGuid || ownGuid).trim().toLowerCase();
    const slot = getPlayerTeamSlot(targetGuid, teamName);
    if (slot === null) {
      return NextResponse.json({ message: "Jogador alvo nao encontrado no time." }, { status: 403 });
    }

    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    if (!isPlayerInTeam(ownGuid, teamName)) {
      return NextResponse.json({ message: "Somente membros do proprio time podem salvar avatar." }, { status: 403 });
    }

    const isAdmin = await isAdminOne(connection, ownGuid);
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

    const decoded = decodeBase64Image(fileBase64);
    if (!decoded || !decoded.bytes.length) {
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
      return NextResponse.json({ message: "Imagem muito grande ou vazia." }, { status: 400 });
    }

    const ext = filterMode === "remove-white" ? ".png" : extFromFilename(filename) || extFromMimeType(mimeType);
    const teamFolder = slugify(teamName) || "time";
    const dir = path.join(PHOTO_DIR, teamFolder);
    await mkdir(dir, { recursive: true });

    await clearExistingSlotFiles(dir, slot);

    const fileName = filterMode === "remove-white" ? `${slot}bg${ext}` : `${slot}${ext}`;
    const absolutePath = path.join(dir, fileName);
    await writeFile(absolutePath, bytes);

    const publicPath = `/fotostime/${teamFolder}/${fileName}`;
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
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}
