import { useEffect, useState } from "react"
import Image from "next/image"

interface InscricoesModalProps {
  alwaysShow?: boolean
}

export default function InscricoesModal({ alwaysShow = false }: InscricoesModalProps) {
  const [open, setOpen] = useState(false)

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
          onClick={() => setOpen(false)}
          aria-label="Fechar"
        >
          ×
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gold mb-2">Inscrições abertas!</h2>
          <p className="text-white mb-4">20 de Abril até 4 de Maio</p>
          <p className="text-gray-300 mb-4">Garanta sua vaga no maior campeonato de Counter-Strike 2 de Sergipe!</p>
          <a
            href="/copadraft/inscricao"
            className="inline-block bg-gold text-black font-bold py-2 px-6 rounded-md hover:bg-gold/80 transition-colors mt-2"
          >
            Inscreva-se agora
          </a>
        </div>
      </div>
    </div>
  )
}
