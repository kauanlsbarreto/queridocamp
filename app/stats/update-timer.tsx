"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface UpdateTimerProps {
  generatedAt: number
  revalidate: number
}

export default function UpdateTimer({ generatedAt, revalidate }: UpdateTimerProps) {
  const router = useRouter()
  const [minutes, setMinutes] = useState(Math.ceil(revalidate / 60))

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now()
      const expiresAt = generatedAt + (revalidate * 1000)
      const diffMs = expiresAt - now
      
      const mins = Math.ceil(diffMs / 60000)
      
      setMinutes(mins > 0 ? mins : 0)

      if (diffMs <= 0) {
        router.refresh()
      }
    }

    calculateTime()
    const interval = setInterval(calculateTime, 10000)

    return () => clearInterval(interval)
  }, [generatedAt, revalidate, router])

  return (
    <p className="text-center text-gray-400 mb-6">
      {minutes > 0 
        ? `Próxima atualização em ${minutes} minutos`
        : "Atualizando dados..."}
    </p>
  )
}
