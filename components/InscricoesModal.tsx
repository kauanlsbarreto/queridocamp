import Link from "next/link"
import { useEffect, useState } from "react"

interface InscricoesModalProps {
  alwaysShow?: boolean
}

export default function InscricoesModal({ alwaysShow = false }: InscricoesModalProps) {
  const [open, setOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  function handleRequestClose() {
    setConfirmClose(true)
  }

  function handleKeepReading() {
    setConfirmClose(false)
  }

  function handleConfirmClose() {
    setConfirmClose(false)
    setOpen(false)
  }

  useEffect(() => {
    if (alwaysShow) {
      setOpen(true)
      return
    }
    const seen = localStorage.getItem("inscricoesModalSeen")
    if (!seen) {
      setOpen(true)
      localStorage.setItem("inscricoesModalSeen", "true")
    }
  }, [alwaysShow])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gold/20 rounded-xl shadow-xl p-8 max-w-md w-full relative">
        <button
          className="absolute top-2 right-2 text-gold hover:text-white text-2xl"
          onClick={handleRequestClose}
          aria-label="Fechar"
        >
          ×
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gold mb-2">Novidades</h2>
          <p className="text-white/80 mb-4">Confira o que mudou no Copa Draft:</p>
          <ul className="space-y-2 text-left text-sm text-white">
            <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              Agora ficou mais fácil abrir e acompanhar cada partida direto pelas páginas de{" "}
              <Link
                href="/copadraft/jogos"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-gold underline underline-offset-2 hover:text-yellow-200"
              >
                jogos
              </Link>{" "}
              e{" "}
              <Link
                href="/copadraft/rodadas"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-gold underline underline-offset-2 hover:text-yellow-200"
              >
                rodadas
              </Link>
              .
            </li>
            <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              Na página{" "}
              <Link
                href="/copadraft/prediction"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-gold underline underline-offset-2 hover:text-yellow-200"
              >
                Prediction
              </Link>{" "}
              você consegue fazer um{" "}
              <span className="font-bold text-gold">predict</span> de qual time vai ganhar cada jogo e ganhar{" "}
              <span className="font-bold text-gold">moedas</span> para gastar no site.
            </li>
            <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              A página de cada confronto ficou mais completa, com{" "}
              <span className="font-bold text-gold">mapa da partida</span>,{" "}
              <span className="font-bold text-gold">placar</span> e{" "}
              <span className="font-bold text-gold">detalhes atualizados</span>.
            </li>
            <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              As páginas dos{" "}
              <Link
                href="/copadraft/times"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-gold underline underline-offset-2 hover:text-yellow-200"
              >
                times
              </Link>{" "}
              agora mostram mais informações sobre{" "}
              <span className="font-bold text-gold">partidas</span>,{" "}
              <span className="font-bold text-gold">mapas</span> e{" "}
              <span className="font-bold text-gold">desempenho dos jogadores</span>.
            </li>
            <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              Ao acompanhar uma partida ao vivo na{" "}
              <span className="font-bold text-gold">Twitch</span>, você recebe{" "}
              <span className="font-bold text-gold">10 pontos</span> se não for sub, e{" "}
              <span className="font-bold text-gold">15 pontos</span> se for sub.
            </li>
            <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              Também fizemos ajustes para deixar o carregamento dessas informações{" "}
              <span className="font-bold text-gold">mais estável</span>.
            </li>
          </ul>
        </div>

        {confirmClose ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/85 p-6">
            <div className="w-full max-w-sm rounded-xl border border-gold/25 bg-gray-950 p-5 text-center shadow-2xl">
              <h3 className="text-lg font-bold text-gold">Já leu as novidades?</h3>
              <p className="mt-2 text-sm text-white/80">
                Se quiser, você pode continuar lendo agora ou fechar o aviso.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleKeepReading}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Continuar lendo
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClose}
                  className="flex-1 rounded-lg border border-gold/40 bg-gold px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
