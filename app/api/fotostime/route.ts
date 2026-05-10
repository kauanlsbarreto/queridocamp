import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PHOTO_DIR = path.join(process.cwd(), "public", "fotostime");
const SLOT_FILE_REGEX = /^([0-4])(bg)?\.(png|jpe?g|webp)$/i;

function contentTypeByExt(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function normalizeSafePath(value: string) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

async function resolveCaseInsensitiveEntry(dir: string, wantedName: string) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const wantedLower = wantedName.toLowerCase();
  const exact = entries.find((entry) => entry.name === wantedName);
  if (exact) return exact.name;

  const ci = entries.find((entry) => entry.name.toLowerCase() === wantedLower);
  return ci?.name || null;
}

async function resolveFilePath(teamFolder: string, fileName: string) {
  const actualTeamFolder = await resolveCaseInsensitiveEntry(PHOTO_DIR, teamFolder);
  if (!actualTeamFolder) return null;

  const teamDir = path.join(PHOTO_DIR, actualTeamFolder);
  const actualFileName = await resolveCaseInsensitiveEntry(teamDir, fileName);
  if (actualFileName) {
    return path.join(teamDir, actualFileName);
  }

  const slotMatch = fileName.match(SLOT_FILE_REGEX);
  if (!slotMatch) return null;

  const stem = `${slotMatch[1]}${slotMatch[2] || ""}`.toLowerCase();
  const entries = await readdir(teamDir, { withFileTypes: true }).catch(() => []);
  const alt = entries
    .filter((entry) => entry.isFile())
    .find((entry) => {
      const ext = path.extname(entry.name).toLowerCase();
      const base = path.basename(entry.name, ext).toLowerCase();
      return [".png", ".jpg", ".jpeg", ".webp"].includes(ext) && base === stem;
    });

  return alt ? path.join(teamDir, alt.name) : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawPath = String(url.searchParams.get("path") || "").trim();
    const normalized = normalizeSafePath(rawPath);

    const relativePath = normalized.startsWith("fotostime/")
      ? normalized.slice("fotostime/".length)
      : normalized;

    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ message: "Caminho de foto invalido." }, { status: 400 });
    }

    const teamFolder = parts[0];
    const fileName = parts.slice(1).join("/");
    if (fileName.includes("..")) {
      return NextResponse.json({ message: "Caminho invalido." }, { status: 400 });
    }

    const resolvedPath = await resolveFilePath(teamFolder, fileName);
    if (!resolvedPath) {
      return NextResponse.json({ message: "Imagem nao encontrada." }, { status: 404 });
    }

    const bytes = await readFile(resolvedPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentTypeByExt(resolvedPath),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ message: "Erro ao carregar imagem." }, { status: 500 });
  }
}
