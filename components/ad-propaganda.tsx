"use client"

import { useState, useEffect, useRef } from "react"
import { ExternalLink, Volume2, VolumeX } from "lucide-react"

interface AdPropagandaProps {
  videoSrc: string
  redirectUrl: string
}

export default function AdPropaganda({ videoSrc, redirectUrl }: AdPropagandaProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("faceit_user")
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        const adminLevel = user.admin
        if (adminLevel && adminLevel >= 1 && adminLevel <= 5) {
          setIsVisible(false)
          return
        }
      } catch (e) {
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        videoRef.current?.pause()
      } else {
        videoRef.current?.play()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    if (videoRef.current) {
      videoRef.current.play().catch(() => {
      })
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const handleVideoEnd = () => {
    setIsVisible(false)
  }

  const handleClick = () => {
    window.open(redirectUrl, "_blank")
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-5xl w-full relative flex flex-col items-center">
        <div 
          className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/10 group cursor-pointer"
          onClick={handleClick}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            playsInline
            autoPlay
            muted={isMuted}
            preload="auto"
            onEnded={handleVideoEnd}
          />
          
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-gold/90 text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 transform scale-95 group-hover:scale-100 transition-transform">
              Visitar Site <ExternalLink size={20} />
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsMuted(!isMuted)
            }}
            className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-white hover:bg-black/70 transition-colors"
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-gold text-xl font-bold animate-pulse">
            O site será exibido ao final do anúncio...
          </p>
          <p className="text-gray-500 text-sm">
            Clique no vídeo para saber mais
          </p>
        </div>
      </div>
    </div>
  )
}
