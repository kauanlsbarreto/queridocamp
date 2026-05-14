"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

const FEEDBACK_DELAY_MS = 50_000
const FEEDBACK_COOLDOWN_MS = 60 * 60 * 1000
const FEEDBACK_STORAGE_KEY = "qc_site_feedback_sent_at_v1"
const FEEDBACK_SECRET = "qc-site-feedback-anon-v1"

function encodeBase64(bytes: Uint8Array) {
  let binary = ""
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function xorBytes(value: string, secret: string) {
  const input = new TextEncoder().encode(value)
  const key = new TextEncoder().encode(secret)
  const output = new Uint8Array(input.length)

  for (let index = 0; index < input.length; index += 1) {
    output[index] = input[index] ^ key[index % key.length]
  }

  return output
}

async function getCryptoKey() {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(FEEDBACK_SECRET))
  return window.crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"])
}

async function encryptFeedbackTimestamp(value: string) {
  try {
    if (!window.crypto?.subtle) throw new Error("SubtleCrypto indisponível")

    const key = await getCryptoKey()
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(value)
    )

    return `v1.${encodeBase64(iv)}.${encodeBase64(new Uint8Array(encrypted))}`
  } catch {
    return `fallback.${encodeBase64(xorBytes(value, FEEDBACK_SECRET))}`
  }
}

async function decryptFeedbackTimestamp(value: string) {
  if (!value) return null

  try {
    if (value.startsWith("v1.")) {
      const [, ivRaw, encryptedRaw] = value.split(".")
      if (!ivRaw || !encryptedRaw || !window.crypto?.subtle) return null
      const key = await getCryptoKey()
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(ivRaw) },
        key,
        decodeBase64(encryptedRaw)
      )
      return new TextDecoder().decode(decrypted)
    }

    if (value.startsWith("fallback.")) {
      const bytes = decodeBase64(value.slice("fallback.".length))
      const secret = new TextEncoder().encode(FEEDBACK_SECRET)
      const output = new Uint8Array(bytes.length)

      for (let index = 0; index < bytes.length; index += 1) {
        output[index] = bytes[index] ^ secret[index % secret.length]
      }

      return new TextDecoder().decode(output)
    }
  } catch {
    return null
  }

  return null
}

async function getLastFeedbackSentAt() {
  const encrypted = localStorage.getItem(FEEDBACK_STORAGE_KEY)
  if (!encrypted) return null

  const decrypted = await decryptFeedbackTimestamp(encrypted)
  const timestamp = Number(decrypted)
  return Number.isFinite(timestamp) ? timestamp : null
}

async function saveLastFeedbackSentAt(timestamp: number) {
  const encrypted = await encryptFeedbackTimestamp(String(timestamp))
  localStorage.setItem(FEEDBACK_STORAGE_KEY, encrypted)
}

function StarSelector({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-2xl leading-none transition ${
              (value || 0) >= star ? "text-gold" : "text-white/25 hover:text-white/50"
            }`}
            aria-label={`${star} estrelas`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="text-xs text-white/60">
        {value === null ? "Escolha de 1 a 5 estrelas." : `Nota atual: ${value}/5`}
      </p>
    </div>
  )
}

export default function SiteFeedbackPrompt() {
  const pathname = usePathname()
  const timerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [overallRating, setOverallRating] = useState<number | null>(null)
  const [performanceRating, setPerformanceRating] = useState<number | null>(null)
  const [informationRating, setInformationRating] = useState<number | null>(null)
  const [wantsComment, setWantsComment] = useState<boolean | null>(null)
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const detailQuestionsReady = overallRating !== null
  const allRatingsReady = overallRating !== null && performanceRating !== null && informationRating !== null

  function clearPromptTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function resetForm() {
    setOverallRating(null)
    setPerformanceRating(null)
    setInformationRating(null)
    setWantsComment(null)
    setComment("")
    setSending(false)
    setError("")
    setSuccess("")
  }

  function closePrompt() {
    clearPromptTimer()
    setDismissed(true)
    setOpen(false)
    resetForm()
  }

  async function submitFeedback(commentValue: string) {
    if (!allRatingsReady) return

    setSending(true)
    setError("")

    try {
      const userRaw = localStorage.getItem("faceit_user")
      let nickname = ""
      let loggedIn = false

      if (userRaw) {
        try {
          const parsed = JSON.parse(userRaw)
          nickname = String(parsed?.nickname || "").trim()
          loggedIn = Boolean(nickname)
        } catch {
          nickname = ""
          loggedIn = false
        }
      }

      const response = await fetch("/api/site-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymous: true,
          loggedIn,
          nickname,
          currentPath: pathname,
          currentUrl: window.location.href,
          pageTitle: document.title,
          ratings: {
            overall: overallRating,
            performance: performanceRating,
            information: informationRating,
          },
          comment: commentValue.trim() || null,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "-",
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          screen: `${window.screen.width}x${window.screen.height}`,
          submittedAt: new Date().toISOString(),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(String(data?.message || "Não foi possível enviar o feedback."))
      }

      const now = Date.now()
      await saveLastFeedbackSentAt(now)
      setSuccess("Feedback enviado. Obrigado por ajudar a melhorar o site.")
      window.setTimeout(() => {
        setDismissed(true)
        setOpen(false)
        resetForm()
      }, 1400)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao enviar feedback.")
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    setOpen(false)
    setDismissed(false)
    resetForm()
    clearPromptTimer()

    ;(async () => {
      const lastSentAt = await getLastFeedbackSentAt().catch(() => null)
      if (cancelled) return

      if (lastSentAt && Date.now() - lastSentAt < FEEDBACK_COOLDOWN_MS) {
        return
      }

      timerRef.current = window.setTimeout(() => {
        if (!dismissed) {
          setOpen(true)
        }
      }, FEEDBACK_DELAY_MS)
    })()

    return () => {
      cancelled = true
      clearPromptTimer()
    }
  }, [pathname])

  if (!open) return null

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-gold/25 bg-[#071331]/95 p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <button
        type="button"
        onClick={closePrompt}
        className="absolute right-3 top-3 text-xl text-gold transition hover:text-white"
        aria-label="Fechar feedback"
      >
        ×
      </button>

      <div className="pr-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold/85">Feedback anônimo</p>
        <h3 className="mt-2 text-lg font-black text-white">Quer dar um feedback?</h3>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-sm font-bold text-white">Nota geral</p>
        <StarSelector
          value={overallRating}
          onChange={(value) => {
            setOverallRating(value)
            setWantsComment(null)
            setError("")
          }}
        />
      </div>

      {detailQuestionsReady ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-bold text-white">Como você avalia a performance do site?</p>
            <p className="mt-1 text-xs text-white/60">De 1 a 5 estrelas.</p>
            <div className="mt-3">
              <StarSelector
                value={performanceRating}
                onChange={(value) => {
                  setPerformanceRating(value)
                  setWantsComment(null)
                  setError("")
                }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-bold text-white">Você encontrou todas as informações que precisava?</p>
            <p className="mt-1 text-xs text-white/60">De 1 a 5 estrelas.</p>
            <div className="mt-3">
              <StarSelector
                value={informationRating}
                onChange={(value) => {
                  setInformationRating(value)
                  setWantsComment(null)
                  setError("")
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {allRatingsReady ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          {wantsComment === null ? (
            <>
              <p className="text-sm font-bold text-white">Quer comentar sobre sua nota?</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setWantsComment(true)}
                  className="flex-1 rounded-lg border border-gold/40 bg-gold px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
                >
                  Quero comentar
                </button>
                <button
                  type="button"
                  onClick={() => void submitFeedback("")}
                  disabled={sending}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Enviando..." : "Enviar sem comentar"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="site-feedback-comment" className="text-sm font-bold text-white">
                Comentário opcional
              </label>
              <textarea
                id="site-feedback-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value.slice(0, 800))}
                rows={4}
                maxLength={800}
                placeholder="Se quiser, conte o que melhorou ou o que ainda falta."
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#020817] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-gold/50"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setWantsComment(null)}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => void submitFeedback(comment)}
                  disabled={sending}
                  className="flex-1 rounded-lg border border-gold/40 bg-gold px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Enviando..." : "Enviar feedback"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}
    </div>
  )
}