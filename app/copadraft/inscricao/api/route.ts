import { NextResponse } from "next/server"
import { getRuntimeEnv } from "@/lib/runtime-env"
import { createMainConnection } from "@/lib/db"
import type { RowDataPacket } from "mysql2"

type Env = {
  DB_PRINCIPAL: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
};

type FaceitPlayerPayload = {
  player_id?: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
};

type PlayerLookupRow = RowDataPacket & {
  nickname: string | null;
  avatar: string | null;
};

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

function getFaceitApiKey() {
  const envKey = typeof process !== "undefined" ? process.env.FACEIT_API_KEY?.trim() : "";
  return envKey || FALLBACK_FACEIT_API_KEY;
}

function getFaceitAvatarUrl(payload: FaceitPlayerPayload | null) {
  if (!payload) return "";
  if (typeof payload.avatar === "string" && payload.avatar.trim()) return payload.avatar.trim();
  if (typeof payload.avatar_url === "string" && payload.avatar_url.trim()) return payload.avatar_url.trim();
  return "";
}

async function fetchFaceitPlayerByNickname(nickname: string): Promise<FaceitPlayerPayload | null> {
  try {
    const res = await fetch(
      `${FACEIT_API_BASE}/players?nickname=${encodeURIComponent(nickname)}`,
      { headers: { Authorization: `Bearer ${getFaceitApiKey()}` } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as FaceitPlayerPayload;
    return json || null;
  } catch {
    return null;
  }
}

async function fetchFaceitPlayerByGuid(faceitGuid: string): Promise<FaceitPlayerPayload | null> {
  try {
    const res = await fetch(
      `${FACEIT_API_BASE}/players/${encodeURIComponent(faceitGuid)}`,
      { headers: { Authorization: `Bearer ${getFaceitApiKey()}` } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as FaceitPlayerPayload;
    return json || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("comprovante") as File | null;

  const nomeCompleto = String(data.get("nomeCompleto") || "");
  const faceitLink = String(data.get("faceitLink") || "");
  const gcLink = String(data.get("gcLink") || "");
  const steamLink = String(data.get("steamLink") || "");
  const telefone = String(data.get("telefone") || "");
  const jogouOutrosDrafts = String(data.get("jogouOutrosDrafts") || "false");
  const nicknameMatch = faceitLink.match(/faceit.com\/(?:[a-z]{2}\/)?players\/([^/?#]+)/i);
  const faceitNickname = nicknameMatch?.[1] || "";

  // Prioriza o faceit_guid enviado pelo frontend, se existir
  let faceitGuid: string | null = data.get("faceit_guid") as string | null;
  let faceitProfile: FaceitPlayerPayload | null = null;

  if (!faceitGuid) {
    if (faceitNickname) {
      faceitProfile = await fetchFaceitPlayerByNickname(faceitNickname);
      if (faceitProfile && typeof faceitProfile.player_id === "string" && faceitProfile.player_id) {
        faceitGuid = faceitProfile.player_id;
      }
    }
  }

  let dbNickname = "";
  let dbAvatar = "";
  if (faceitGuid) {
    let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;
    try {
      const env = await getRuntimeEnv();
      connection = await createMainConnection(env);

      const [rows] = await connection.query<PlayerLookupRow[]>(
        "SELECT nickname, avatar FROM players WHERE faceit_guid = ? LIMIT 1",
        [faceitGuid]
      );

      if (Array.isArray(rows) && rows.length > 0) {
        dbNickname = String(rows[0]?.nickname || "").trim();
        dbAvatar = String(rows[0]?.avatar || "").trim();
      }
    } catch {}
    finally {
      if (connection) await connection.end().catch(() => {});
    }
  }

  // Fallback: se nao encontrou nome/foto na tabela players, busca na API da FACEIT.
  if (faceitGuid && (!dbNickname || !dbAvatar)) {
    if (!faceitProfile) {
      faceitProfile = await fetchFaceitPlayerByGuid(faceitGuid);
    }
  }

  const resolvedFaceitNickname = dbNickname
    || String(faceitProfile?.nickname || "").trim()
    || faceitNickname
    || "Nao encontrado";
  const resolvedFaceitAvatar = dbAvatar || getFaceitAvatarUrl(faceitProfile);

  const embedFields = [
    { name: "Nome Completo", value: nomeCompleto, inline: false },
    { name: "Link do Faceit", value: faceitLink, inline: false },
    { name: "faceit_guid", value: faceitGuid || "", inline: false },
    { name: "Nickname FACEIT", value: resolvedFaceitNickname, inline: false },
    { name: "Link do perfil GC", value: gcLink, inline: false },
    { name: "Link da Steam", value: steamLink, inline: false },
    { name: "Telefone", value: telefone, inline: false },
    { name: "Já jogou outros drafts?", value: jogouOutrosDrafts === "true" ? "Sim" : "Não", inline: false },
    file ? { name: "Comprovante", value: file.type === "application/pdf" ? "Clique para abrir o PDF" : file.name, inline: false } : null,
  ].filter(Boolean);

  const form = new FormData();
  if (file) {
    form.append("files[0]", file, file.name);
  }

  form.append(
    "payload_json",
    JSON.stringify({
      embeds: [
        {
          title: "Nova inscrição Querido Draft",
          color: 0x00ff00, // verde
          fields: embedFields,
          thumbnail: resolvedFaceitAvatar ? { url: resolvedFaceitAvatar } : undefined,
          image: file && !file.type.includes("pdf") ? { url: "attachment://" + file.name } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    })
  );

  try {
    const response = await fetch("https://discord.com/api/webhooks/1447677740298932265/iKskHoGWMysbUXCxWTeZaxrj9VGPh_cJdtYZ3GsA6mB_XbnOe1SRix9wOWGQAqokAnkO", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`);
    }
  } catch (error) {
    console.warn("Falha ao enviar webhook de inscrição.", error);
  }

  return NextResponse.json({ ok: true });
}
