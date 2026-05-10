import { readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { createMainConnection } from "@/lib/db";
import { isPlayerInTeam } from "@/lib/copadraft-team-access";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PHOTO_DIR = path.join(process.cwd(), "public", "fotostime");
const SLOT_FILE_REGEX = /^[0-4](bg)?\.(png|jpe?g|webp)$/i;

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

function isImageFile(filename: string) {
  return /\.(png|jpe?g|webp)$/i.test(filename);
}

function mimeTypeFromName(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
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

export async function GET(request: Request) {
  let connection: any = null;

  try {
    const url = new URL(request.url);
    const faceitGuid = String(url.searchParams.get("faceit_guid") || "").trim();
    const teamName = String(url.searchParams.get("time") || "").trim();

    if (!faceitGuid || !teamName) {
      return NextResponse.json({ message: "faceit_guid e time sao obrigatorios." }, { status: 400 });
    }

    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const isAdmin = await isAdminOne(connection, faceitGuid);

    if (!isAdmin && !isPlayerInTeam(faceitGuid, teamName)) {
      return NextResponse.json({ message: "Somente membros do proprio time podem listar fotos." }, { status: 403 });
    }

    const teamFolder = slugify(teamName) || "time";
    const absoluteDir = path.join(PHOTO_DIR, teamFolder);
    const entries = await readdir(absoluteDir, { withFileTypes: true }).catch(() => []);

    const photos = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => isImageFile(name) && !SLOT_FILE_REGEX.test(name))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .map((name) => ({
        id: name,
        name,
        mimeType: mimeTypeFromName(name),
        previewUrl: `/fotostime/${teamFolder}/${encodeURIComponent(name)}`,
      }));

    return NextResponse.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar fotos da pasta.";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}
