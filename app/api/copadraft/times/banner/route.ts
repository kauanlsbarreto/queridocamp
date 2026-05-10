import { NextResponse } from "next/server";

import { createMainConnection } from "@/lib/db";
import { getCopaDraftTimes } from "@/lib/copadraft-times";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type BannerRow = {
  id: number;
  time: string;
  zoom: number;
  x: number;
  y: number;
  largura: number;
  altura: number;
  ordem: string | null;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(value: unknown, min: number, max: number) {
  const n = Math.trunc(toNumber(value));
  return Math.min(max, Math.max(min, n));
}

function clampFloatMin(value: unknown, min: number) {
  const n = toNumber(value);
  const clamped = Math.max(min, n);
  return Number(clamped.toFixed(2));
}

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isTeamMember(faceitGuid: string, teamName: string) {
  const wantedGuid = String(faceitGuid || "").trim().toLowerCase();
  const wantedTeam = normalizeText(teamName);
  if (!wantedGuid || !wantedTeam) return false;

  const teams = getCopaDraftTimes();
  const team = teams.find((item) => normalizeText(item?.nome_time) === wantedTeam);
  if (!team) return false;

  return (team.jogadores || []).some(
    (player) => String(player?.faceit_guid || "").trim().toLowerCase() === wantedGuid
  );
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
    const time = String(url.searchParams.get("time") || "").trim();

    if (!time) {
      return NextResponse.json({ message: "Parametro time ausente." }, { status: 400 });
    }

    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const [rows] = await connection.query(
      "SELECT id, time, zoom, x, y, largura, altura, ordem FROM banner WHERE time = ? LIMIT 1",
      [time]
    );

    const row = Array.isArray(rows) ? (rows as BannerRow[])[0] : null;

    if (!row) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({
      config: {
        id: row.id,
        time: String(row.time || time),
        zoom: toNumber(row.zoom) || 1,
        x: Math.trunc(toNumber(row.x)),
        y: Math.trunc(toNumber(row.y)),
        largura: Math.max(320, Math.trunc(toNumber(row.largura) || 1100)),
        altura: Math.max(120, Math.trunc(toNumber(row.altura) || 280)),
        ordem: String(row.ordem || "").trim().slice(0, 10),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar banner.";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}

export async function POST(request: Request) {
  let connection: any = null;

  try {
    const payload = await request.json().catch(() => null);
    const faceitGuid = String(payload?.faceit_guid || "").trim();
    const time = String(payload?.time || "").trim();

    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid ausente." }, { status: 400 });
    }

    if (!time) {
      return NextResponse.json({ message: "time ausente." }, { status: 400 });
    }

    const zoom = clampFloatMin(payload?.zoom, 0.05);
    const x = clampInt(payload?.x, -2000, 2000);
    const y = clampInt(payload?.y, -1200, 1200);
    const largura = clampInt(payload?.largura, 320, 1800);
    const altura = clampInt(payload?.altura, 120, 700);
    const ordem = String(payload?.ordem || "").trim().slice(0, 10);
    const changingOrder = Object.prototype.hasOwnProperty.call(payload || {}, "ordem");

    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const allowed = await isAdminOne(connection, faceitGuid);
    if (!allowed) {
      return NextResponse.json({ message: "Apenas Admin 1 pode salvar o banner." }, { status: 403 });
    }

    if (changingOrder && !isTeamMember(faceitGuid, time)) {
      return NextResponse.json({ message: "Apenas Admin 1 do proprio time pode alterar a ordem." }, { status: 403 });
    }

    const [existingRows] = await connection.query(
      "SELECT id, ordem FROM banner WHERE time = ? LIMIT 1",
      [time]
    );
    const existing = Array.isArray(existingRows)
      ? (existingRows as Array<{ id: number | null; ordem: string | null }>)[0]
      : null;
    const ordemToSave = changingOrder ? ordem : String(existing?.ordem || "").trim().slice(0, 10);

    if (existing?.id) {
      await connection.query(
        "UPDATE banner SET zoom = ?, x = ?, y = ?, largura = ?, altura = ?, ordem = ? WHERE id = ?",
        [zoom, x, y, largura, altura, ordemToSave, existing.id]
      );
    } else {
      await connection.query(
        "INSERT INTO banner (time, zoom, x, y, largura, altura, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [time, zoom, x, y, largura, altura, ordemToSave]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Banner salvo com sucesso.",
      config: {
        time,
        zoom,
        x,
        y,
        largura,
        altura,
        ordem: ordemToSave,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar banner.";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}
