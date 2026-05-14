import { NextResponse } from "next/server"

const DISCORD_WEBHOOK_URL =
  process.env.SITE_FEEDBACK_DISCORD_WEBHOOK_URL?.trim() ||
  "https://discord.com/api/webhooks/1504417723814379571/R3TzTjuJsDWPLxT-FqhR-9H6ELJgymZA1TMjjMraC1WwWTBYDQSjPD9aHkIwVmusH6Mx"

type SiteFeedbackPayload = {
  anonymous?: boolean
  loggedIn?: boolean
  nickname?: string
  currentPath?: string
  currentUrl?: string
  pageTitle?: string
  ratings?: {
    overall?: number
    performance?: number
    information?: number
  }
  comment?: string
  language?: string
  timezone?: string
  viewport?: string
  screen?: string
  submittedAt?: string
}

function clampRating(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const rounded = Math.round(numeric)
  if (rounded < 0 || rounded > 5) return null
  return rounded
}

function toStars(value: number) {
  return `${"★".repeat(value)}${"☆".repeat(5 - value)} (${value}/5)`
}

function asText(value: unknown, fallback = "-") {
  const text = String(value || "").trim()
  return text || fallback
}

export async function POST(request: Request) {
  let body: SiteFeedbackPayload

  try {
    body = (await request.json()) as SiteFeedbackPayload
  } catch {
    return NextResponse.json({ ok: false, message: "Payload inválido." }, { status: 400 })
  }

  const overall = clampRating(body?.ratings?.overall)
  const performance = clampRating(body?.ratings?.performance)
  const information = clampRating(body?.ratings?.information)

  if (overall === null || performance === null || information === null) {
    return NextResponse.json({ ok: false, message: "As notas devem estar entre 0 e 5." }, { status: 400 })
  }

  const comment = String(body?.comment || "").trim()
  const nickname = String(body?.nickname || "").trim()

  const payload = {
    username: "Feedback do Site",
    embeds: [
      {
        title: "Novo feedback anônimo do site",
        color: 0xd4af37,
        description:
          "Feedback enviado de forma anônima após as mudanças recentes do site.",
        fields: [
          { name: "Anônimo", value: body?.anonymous === false ? "Não" : "Sim", inline: true },
          { name: "Nickname", value: nickname || "Anônimo / não logado", inline: true },
          { name: "Nota geral", value: toStars(overall), inline: true },
          { name: "Performance", value: toStars(performance), inline: true },
          { name: "Tem todas as informações", value: toStars(information), inline: true },
          { name: "Página", value: asText(body?.currentPath), inline: false },
          { name: "URL", value: asText(body?.currentUrl), inline: false },
          { name: "Título da página", value: asText(body?.pageTitle), inline: false },
          { name: "Idioma", value: asText(body?.language), inline: true },
          { name: "Fuso horário", value: asText(body?.timezone), inline: true },
          { name: "Viewport", value: asText(body?.viewport), inline: true },
          { name: "Tela", value: asText(body?.screen), inline: true },
          { name: "Comentário", value: comment || "Sem comentário.", inline: false },
        ],
        footer: {
          text: "QueridoCamp • Feedback anônimo",
        },
        timestamp: body?.submittedAt || new Date().toISOString(),
      },
    ],
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json(
        { ok: false, message: `Falha ao enviar webhook: ${response.status} ${errorText}`.trim() },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Erro ao enviar feedback.",
      },
      { status: 500 }
    )
  }
}