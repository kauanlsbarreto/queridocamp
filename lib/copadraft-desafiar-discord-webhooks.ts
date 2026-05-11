type DesafiarWebhookEvent = "sent" | "decision" | "counter";
type DesafiarDecision = "accepted" | "declined";

type DesafiarDiscordPayload = {
  event: DesafiarWebhookEvent;
  decision?: DesafiarDecision;
  matchId: number;
  rodada: number | null;
  challengerTeam: string;
  challengedTeam: string;
  actorNickname: string;
  actorGuid: string;
  date: string | null;
  time: string | null;
  message?: string | null;
  forceColor?: "orange";
  adminChangedAcceptedMatch?: boolean;
  beforeDate?: string | null;
  beforeTime?: string | null;
};

const WEBHOOK_SENT =
  "https://discord.com/api/webhooks/1502368470535372881/GZZ-TMzONs34Q7nBkgvFunu1AwqVAwGE1e4upavY0Ntyc8Id5DkRAZ77UehH4Zdnszt8";
const WEBHOOK_DECISION =
  "https://discord.com/api/webhooks/1502368569806291066/9OP4YPxsEwskpjjBAWhudbB9LwadP_w0ScZ9I0skseRbmdZHHpihJOoiZVuBFwhTlxKB";
const WEBHOOK_COUNTER =
  "https://discord.com/api/webhooks/1502368635644149830/V2V7WdHVvlMalLGVGJcyjFOucWH6vOarw0jgrIq2d1vFduKa7QSGB3R9q_xbqHkzE-uP";

function getWebhookByEvent(event: DesafiarWebhookEvent) {
  if (event === "sent") return WEBHOOK_SENT;
  if (event === "counter") return WEBHOOK_COUNTER;
  return WEBHOOK_DECISION;
}

function getTitle(payload: DesafiarDiscordPayload) {
  if (payload.event === "sent") return "CopaDraft - Proposta enviada";
  if (payload.event === "counter") return "CopaDraft - Contraproposta enviada";
  if (payload.adminChangedAcceptedMatch) return "CopaDraft - Data alterada em partida aceita";
  return payload.decision === "accepted"
    ? "CopaDraft - Proposta aceita"
    : "CopaDraft - Proposta recusada";
}

function getColor(payload: DesafiarDiscordPayload) {
  if (payload.forceColor === "orange") return 0xf59e0b;
  if (payload.event === "sent") return 0x38bdf8;
  if (payload.event === "counter") return 0x3b82f6;
  return payload.decision === "accepted" ? 0x22c55e : 0xef4444;
}

function safe(value: unknown) {
  const text = String(value || "").trim();
  return text || "-";
}

export async function sendDesafiarDiscordWebhook(payload: DesafiarDiscordPayload) {
  const url = getWebhookByEvent(payload.event);
  const isAdminAcceptedChange = payload.adminChangedAcceptedMatch;
  const beforeText = `${safe(payload.beforeDate)} as ${safe(payload.beforeTime)}`;
  const afterText = `${safe(payload.date)} as ${safe(payload.time)}`;
  const fields = [
    { name: "Confronto", value: `${safe(payload.challengerTeam)} x ${safe(payload.challengedTeam)}` },
    { name: "Quem fez", value: `${safe(payload.actorNickname)} (${safe(payload.actorGuid)})` },
    { name: "Rodada", value: safe(payload.rodada), inline: true },
    { name: "Data", value: safe(payload.date), inline: true },
    { name: "Horario", value: safe(payload.time), inline: true },
    { name: "Match ID", value: safe(payload.matchId), inline: true },
  ] as Array<{ name: string; value: string; inline?: boolean }>;

  if (isAdminAcceptedChange) {
    fields.push(
      { name: "Jogo alterado", value: `${safe(payload.challengerTeam)} x ${safe(payload.challengedTeam)} (Rodada ${safe(payload.rodada)})` },
      { name: "Antes", value: beforeText, inline: true },
      { name: "Depois", value: afterText, inline: true },
    );
  }

  fields.push({ name: "Mensagem", value: safe(payload.message) });

  const body = {
    embeds: [
      {
        title: getTitle(payload),
        color: getColor(payload),
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[desafiar-discord] webhook erro:", res.status, text);
      return { sent: false, status: res.status, error: text || "discord webhook non-ok" };
    }

    return { sent: true, status: res.status };
  } catch (error) {
    console.error("[desafiar-discord] webhook exception:", error);
    return { sent: false, error: error instanceof Error ? error.message : "unknown error" };
  }
}
