"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BarChart2, Download, Loader2 } from "lucide-react"

const DEFAULT_AVATAR = "/images/cs2-player.png"

const ROUND_OPTIONS = [
  { label: "Geral", value: "geral" },
  { label: "Rodada 1", value: "1" },
  { label: "Rodada 2", value: "2" },
  { label: "Rodada 3", value: "3" },
  { label: "Rodada 4", value: "4" },
  { label: "Rodada 5", value: "5" },
  { label: "Rodada 6", value: "6" },
  { label: "Rodada 7", value: "7" },
] as const

interface Props {
  player: any
  isOwnProfile?: boolean
  userAdminLevel?: number
}

interface CopaDraftData {
  nickname: string
  teamName: string | null
  pote: number
  avatar: string
  selectedRound?: number | "geral"
  availableRounds?: number[]
  stats: {
    appearances: number
    kills: number
    deaths: number
    kd: number
    hltv: number
    adr: number
    score: number
    hs: number
    kast: number
  }
}

function loadImg(src: string, crossOrigin?: "anonymous" | "use-credentials"): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) {
    ctx.drawImage(img, dx, dy, dw, dh)
    return
  }

  const scale = Math.min(dw / iw, dh / ih, 1)
  const rw = iw * scale
  const rh = ih * scale
  const rx = dx + (dw - rw) / 2
  const ry = dy + (dh - rh) / 2
  ctx.drawImage(img, rx, ry, rw, rh)
}

export default function WorldCupCard({ player, isOwnProfile = false, userAdminLevel = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastAutoPreviewKeyRef = useRef("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRound, setSelectedRound] = useState<string>("geral")
  const [availableRounds, setAvailableRounds] = useState<number[]>([])
  const [data, setData] = useState<CopaDraftData | null>(null)

  useEffect(() => {
    const guid = player?.faceit_guid
    if (!guid) {
      setData(null)
      setAvailableRounds([])
      return
    }

    setLoading(true)
    fetch(
      `/api/copadraft/player-card-data?faceit_guid=${encodeURIComponent(guid)}&round=${encodeURIComponent(selectedRound)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (!payload) return
        setData(payload)
        setAvailableRounds(Array.isArray(payload.availableRounds) ? payload.availableRounds : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [player?.faceit_guid, selectedRound])

  useEffect(() => {
    setSelectedRound("geral")
  }, [player?.faceit_guid])

  useEffect(() => {
    if (selectedRound === "geral") return
    const roundNumber = Number(selectedRound)
    if (!availableRounds.includes(roundNumber)) {
      setSelectedRound("geral")
    }
  }, [availableRounds, selectedRound])

  const generateCard = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setGenerating(true)

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setGenerating(false)
      return
    }

    const W = 1080
    const H = 1920
    canvas.width = W
    canvas.height = H

    const stats = data?.stats
    const displayNick = (data?.nickname || player?.nickname || "Jogador").toUpperCase()
    const displayPote = data?.pote || player?.pote || 0
    const displayTeam = data?.teamName || null

    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0, "#040d1f")
    bgGrad.addColorStop(0.5, "#071331")
    bgGrad.addColorStop(1, "#051020")
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.globalAlpha = 0.024
    ctx.strokeStyle = "#06b6d4"
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 80) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (let y = 0; y < H; y += 80) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.restore()

    ctx.save()
    const glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 680)
    glow.addColorStop(0, "rgba(6,182,212,0.06)")
    glow.addColorStop(1, "transparent")
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.restore()

    const headerGrad = ctx.createLinearGradient(0, 0, W, 0)
    headerGrad.addColorStop(0, "#0e4f6b")
    headerGrad.addColorStop(0.5, "#0891b2")
    headerGrad.addColorStop(1, "#0e4f6b")

    ctx.fillStyle = headerGrad
    ctx.fillRect(0, 0, W, 140)
    ctx.fillStyle = "#06b6d4"
    ctx.fillRect(0, 138, W, 4)

    try {
      const logo = await loadImg("/logo.png")
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.drawImage(logo, 48, 30, 80, 80)
      ctx.restore()
    } catch {
      // ignore logo errors
    }

    ctx.save()
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 64px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = "#06b6d4"
    ctx.shadowBlur = 16
    ctx.fillText("COPA DRAFT", W / 2 + 20, 70)
    ctx.restore()

    const AY = 430
    const avatarSrc = data?.avatar || player?.avatar || DEFAULT_AVATAR
    const isCustomAvatar = avatarSrc.includes("/api/fotostime") || avatarSrc.includes("/fotostime/")
    const AR = 210
    const CX = W / 2
    const customW = 680
    const customH = 800
    const customX = (W - customW) / 2
    const customY = 182

    if (!isCustomAvatar) {
      ctx.save()
      ctx.shadowColor = "#06b6d4"
      ctx.shadowBlur = 56
      ctx.strokeStyle = "rgba(6,182,212,0.36)"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(CX, AY, AR + 22, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.shadowColor = "#06b6d4"
      ctx.shadowBlur = 30
      ctx.strokeStyle = "#06b6d4"
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(CX, AY, AR + 12, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    let drawn = false
    if (isCustomAvatar) {
      try {
        const img = await loadImg(avatarSrc, "anonymous")
        drawImageContain(ctx, img, customX, customY, customW, customH)
        drawn = true
      } catch {
        // CORS fallback
      }

      if (!drawn) {
        try {
          const fallback = await loadImg(DEFAULT_AVATAR)
          drawImageContain(ctx, fallback, customX, customY, customW, customH)
        } catch {
          ctx.fillStyle = "#071331"
          ctx.fillRect(customX, customY, customW, customH)
        }
      }

      // Name overlay at bottom of custom photo (same visual direction as team cards)
      const nameGrad = ctx.createLinearGradient(0, customY + customH - 210, 0, customY + customH)
      nameGrad.addColorStop(0, "rgba(0,0,0,0)")
      nameGrad.addColorStop(1, "rgba(0,0,0,0.82)")
      ctx.fillStyle = nameGrad
      ctx.fillRect(customX, customY + customH - 210, customW, 210)

      ctx.save()
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = "#ffffff"
      ctx.shadowColor = "rgba(0,0,0,0.9)"
      ctx.shadowBlur = 20
      let overlayFontSize = 88
      ctx.font = `bold ${overlayFontSize}px Arial`
      while (ctx.measureText(displayNick).width > customW - 60 && overlayFontSize > 48) {
        overlayFontSize -= 4
        ctx.font = `bold ${overlayFontSize}px Arial`
      }
      ctx.fillText(displayNick, CX, customY + customH - 68)
      ctx.restore()
    } else {
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, AY, AR, 0, Math.PI * 2)
      ctx.clip()
      try {
        const img = await loadImg(avatarSrc, "anonymous")
        ctx.drawImage(img, CX - AR, AY - AR, AR * 2, AR * 2)
        drawn = true
      } catch {
        // CORS fallback
      }

      if (!drawn) {
        try {
          const fallback = await loadImg(DEFAULT_AVATAR)
          ctx.drawImage(fallback, CX - AR, AY - AR, AR * 2, AR * 2)
        } catch {
          ctx.fillStyle = "#071331"
          ctx.fillRect(CX - AR, AY - AR, AR * 2, AR * 2)
        }
      }
      ctx.restore()
    }

    const levelSrc = player?.faceit_level_image
    if (levelSrc && !isCustomAvatar) {
      try {
        const lvl = await loadImg(levelSrc)
        ctx.save()
        ctx.shadowColor = "#fbbf24"
        ctx.shadowBlur = 18
        ctx.drawImage(lvl, CX + AR - 16, AY + AR - 16, 96, 96)
        ctx.restore()
      } catch {
        // ignore
      }
    }

    const nameY = AY + AR + 70
    let fontSize = 96
    if (!isCustomAvatar) {
      ctx.save()
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.fillStyle = "#ffffff"
      ctx.shadowColor = "#06b6d4"
      ctx.shadowBlur = 24
      ctx.font = `bold ${fontSize}px Arial`
      while (ctx.measureText(displayNick).width > W - 80 && fontSize > 44) {
        fontSize -= 4
        ctx.font = `bold ${fontSize}px Arial`
      }
      ctx.fillText(displayNick, CX, nameY)
      ctx.restore()
    }

    const subY = isCustomAvatar ? customY + customH + 36 : nameY + fontSize + 20
    if (displayTeam || displayPote) {
      const parts: string[] = []
      if (displayTeam) parts.push(displayTeam.toUpperCase())
      if (displayPote) parts.push(`POTE ${displayPote}`)
      const subText = parts.join("  •  ")

      ctx.save()
      ctx.font = "bold 36px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const subW = ctx.measureText(subText).width + 60
      const subX = CX - subW / 2

      ctx.fillStyle = "rgba(6,182,212,0.12)"
      ctx.strokeStyle = "#06b6d4"
      ctx.lineWidth = 1.5
      roundRect(ctx, subX, subY, subW, 60, 16)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "#a5f3fc"
      ctx.fillText(subText, CX, subY + 30)
      ctx.restore()
    }

    const divY = subY + 82
    ctx.save()
    const divGrad = ctx.createLinearGradient(80, 0, W - 80, 0)
    divGrad.addColorStop(0, "transparent")
    divGrad.addColorStop(0.3, "#06b6d4")
    divGrad.addColorStop(0.7, "#0891b2")
    divGrad.addColorStop(1, "transparent")
    ctx.strokeStyle = divGrad
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(80, divY)
    ctx.lineTo(W - 80, divY)
    ctx.stroke()
    ctx.restore()

    const GRID_TOP = divY + 36
    const PAD = 42
    const GAP = 16
    const COLS = 4
    const CELL_H = 156
    const CELL_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS

    const cardStats = [
      { label: "HLTV 2.0", value: stats ? stats.hltv.toFixed(2) : "-", accent: "#22d3ee" },
      { label: "K/D", value: stats ? stats.kd.toFixed(2) : "-", accent: "#06b6d4" },
      { label: "KILLS", value: stats ? String(stats.kills) : "-", accent: "#a5f3fc" },
      { label: "MORTES", value: stats ? String(stats.deaths) : "-", accent: "#7dd3fc" },
      { label: "ADR", value: stats ? stats.adr.toFixed(1) : "-", accent: "#22d3ee" },
      { label: "SCORE", value: stats ? stats.score.toFixed(1) : "-", accent: "#a5f3fc" },
      { label: "HS%", value: stats ? `${stats.hs.toFixed(1)}%` : "-", accent: "#67e8f9" },
      { label: "KAST%", value: stats ? `${stats.kast.toFixed(1)}%` : "-", accent: "#22d3ee" },
    ]

    cardStats.forEach((item, index) => {
      const row = Math.floor(index / COLS)
      const col = index % COLS
      const x = PAD + col * (CELL_W + GAP)
      const y = GRID_TOP + row * (CELL_H + GAP)
      const cx = x + CELL_W / 2

      ctx.save()
      ctx.fillStyle = "rgba(6,182,212,0.05)"
      ctx.strokeStyle = "rgba(6,182,212,0.2)"
      ctx.lineWidth = 1.3
      roundRect(ctx, x, y, CELL_W, CELL_H, 18)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = item.accent
      ctx.shadowColor = item.accent
      ctx.shadowBlur = 18
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      let valueSize = 48
      ctx.font = `bold ${valueSize}px Arial`
      while (ctx.measureText(item.value).width > CELL_W - 18 && valueSize > 24) {
        valueSize -= 2
        ctx.font = `bold ${valueSize}px Arial`
      }
      ctx.fillText(item.value, cx, y + CELL_H * 0.46)

      ctx.shadowBlur = 0
      ctx.fillStyle = "rgba(255,255,255,0.4)"
      ctx.font = "bold 22px Arial"
      ctx.fillText(item.label, cx, y + CELL_H * 0.8)
      ctx.restore()
    })

    const brandY = GRID_TOP + 2 * (CELL_H + GAP) + 26

    try {
      const logo = await loadImg("/logo.png")
      ctx.save()
      ctx.globalAlpha = 0.84
      ctx.drawImage(logo, CX - 78, brandY + 4, 156, 156)
      ctx.restore()
    } catch {
      // ignore
    }

    ctx.save()
    ctx.fillStyle = "rgba(165,243,252,0.5)"
    ctx.font = "bold 40px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText("queridocamp.com.br", CX, brandY + 168)
    ctx.restore()

    const BAR_H = 100
    ctx.fillStyle = headerGrad
    ctx.fillRect(0, H - BAR_H, W, BAR_H)
    ctx.fillStyle = "#06b6d4"
    ctx.fillRect(0, H - BAR_H, W, 3)
    ctx.save()
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 42px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = "#06b6d4"
    ctx.shadowBlur = 12
    ctx.fillText("COPA DRAFT", CX, H - BAR_H / 2)
    ctx.restore()

    const url = canvas.toDataURL("image/png")
    setPreviewUrl(url)
    setGenerating(false)
  }, [data, player])

  useEffect(() => {
    if (loading || generating) return

    const stats = data?.stats
    const autoPreviewKey = [
      player?.faceit_guid || "",
      player?.nickname || "",
      player?.avatar || "",
      data?.nickname || "",
      data?.avatar || "",
      data?.teamName || "",
      data?.pote || "",
      stats?.appearances || "",
      stats?.kills || "",
      stats?.deaths || "",
      stats?.kd || "",
      stats?.hltv || "",
      stats?.adr || "",
      stats?.score || "",
      stats?.hs || "",
      stats?.kast || "",
    ].join("|")

    if (!autoPreviewKey || autoPreviewKey === lastAutoPreviewKeyRef.current) return
    lastAutoPreviewKeyRef.current = autoPreviewKey
    void generateCard()
  }, [
    data?.avatar,
    data?.nickname,
    data?.pote,
    data?.stats?.adr,
    data?.stats?.appearances,
    data?.stats?.deaths,
    data?.stats?.hs,
    data?.stats?.hltv,
    data?.stats?.kast,
    data?.stats?.kd,
    data?.stats?.kills,
    data?.stats?.score,
    data?.teamName,
    generateCard,
    generating,
    loading,
    player?.avatar,
    player?.faceit_guid,
    player?.nickname,
  ])

  const visibleRoundOptions = ROUND_OPTIONS.filter((option) => {
    if (option.value === "geral") return true
    return availableRounds.includes(Number(option.value))
  })

  if (!isOwnProfile && userAdminLevel !== 1) {
    return null
  }

  return (
    <div className="mt-6">
      <canvas ref={canvasRef} className="hidden" />

      <div className="rounded-2xl border border-cyan-300/20 bg-[#071331]/80 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10">
            <BarChart2 size={20} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Card Copa Draft</h3>
            <p className="text-[11px] text-zinc-400">Gere seu card para redes sociais</p>
          </div>
          {loading && (
            <div className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
              <Loader2 size={12} className="animate-spin" />
              Carregando stats...
            </div>
          )}
        </div>

        {data?.stats && data.stats.appearances > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { l: "HLTV 2.0", v: data.stats.hltv.toFixed(2) },
              { l: "K/D", v: data.stats.kd.toFixed(2) },
              { l: "Kills", v: String(data.stats.kills) },
              { l: "Mortes", v: String(data.stats.deaths) },
              { l: "ADR", v: data.stats.adr.toFixed(1) },
              { l: "Score", v: data.stats.score.toFixed(1) },
              { l: "HS%", v: `${data.stats.hs.toFixed(1)}%` },
              { l: "KAST%", v: `${data.stats.kast.toFixed(1)}%` },
            ].map(({ l, v }) => (
              <div key={l} className="rounded-lg border border-cyan-300/15 bg-black/20 px-2 py-2 text-center">
                <p className="text-[9px] font-bold uppercase text-zinc-500">{l}</p>
                <p className="text-sm font-black text-cyan-300">{v}</p>
              </div>
            ))}
          </div>
        )}

        {!player?.faceit_guid && (
          <p className="mb-4 text-center text-xs text-zinc-500">Perfil sem FACEIT vinculado - stats indisponiveis.</p>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-cyan-300/25 bg-black/20 px-3 py-3">
          <label htmlFor="rodada-card" className="text-xs font-black uppercase tracking-wider text-cyan-200/90">
            Rodada
          </label>

          <div className="relative ml-auto w-[170px]">
            <select
              id="rodada-card"
              value={selectedRound}
              onChange={(event) => setSelectedRound(event.target.value)}
              disabled={loading}
              className="w-full appearance-none rounded-lg border border-cyan-300/40 bg-gradient-to-b from-[#0c234f] to-[#081936] py-2 pl-3 pr-9 text-xs font-black uppercase tracking-wider text-cyan-100 outline-none transition focus:border-cyan-200/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {visibleRoundOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-cyan-200">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M5.25 7.5a.75.75 0 0 1 1.06 0L10 11.19l3.69-3.69a.75.75 0 1 1 1.06 1.06l-4.22 4.22a.75.75 0 0 1-1.06 0L5.25 8.56a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </span>
          </div>

          {generating && <Loader2 size={14} className="animate-spin text-cyan-300" />}
        </div>

        {previewUrl && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="relative w-full max-w-[300px] overflow-hidden rounded-xl border border-cyan-300/25 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <img src={previewUrl} alt="Card Copa Draft" className="h-auto w-full" />
            </div>
            <a
              href={previewUrl}
              download={`card-copa-draft-${data?.nickname || player?.nickname || "jogador"}.png`}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-6 py-3 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:from-cyan-400 hover:to-cyan-300"
            >
              <Download size={16} />
              Baixar
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
