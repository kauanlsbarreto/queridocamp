"use client"

import { useEffect, useState } from "react"

interface UpdateTimerProps {
  generatedAt: number
  revalidate: number
}

export default function UpdateTimer({ generatedAt, revalidate }: UpdateTimerProps) {
  // Inicializa com o tempo total para evitar erro de hidratação
  const [minutes, setMinutes] = useState(Math.ceil(revalidate / 60))

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now()
      // Calcula quando o cache expira (tempo de geração + tempo de revalidação)
      const expiresAt = generatedAt + (revalidate * 1000)
      const diffMs = expiresAt - now
      
      // Converte para minutos arredondando para cima
      const mins = Math.ceil(diffMs / 60000)
      
      // Não mostra menos que 0
      setMinutes(mins > 0 ? mins : 0)
    }

    calculateTime()
    // Atualiza a cada 10 segundos
    const interval = setInterval(calculateTime, 10000)

    return () => clearInterval(interval)
  }, [generatedAt, revalidate])

  return (
    <p className="text-center text-gray-400 mb-6">
      {minutes > 0 
        ? `Próxima atualização em ${minutes} minutos`
        : "Atualizando dados..."}
    </p>
  )
}
