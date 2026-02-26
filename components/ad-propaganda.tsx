"use client"

import { useState, useEffect, useRef } from "react"
import { ExternalLink, Volume2, VolumeX, SkipForward } from "lucide-react"

interface PromoPlayerProps {
  videoSrc: string
  redirectUrl: string
}

export default function PromotionalPlayer({ videoSrc, redirectUrl }: PromoPlayerProps) {
  const [isVisible, setIsVisible] = useState(false) // Começa falso para evitar flash de conteúdo
  const [isMuted, setIsMuted] = useState(true)
  const [volume, setVolume] = useState(0.1)
  const [canSkip, setCanSkip] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Garante que o estado do anúncio é resetado a cada navegação
    if (typeof window !== 'undefined') (window as any).adWasShown = false

    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    const storedUser = localStorage.getItem("faceit_user")
    
    if (storedUser && !isLocalhost) {
      try {
        const user = JSON.parse(storedUser)
        if (user.Admin >= 1 && user.Admin <= 5) return 
      } catch (e) {}
    }

    const hasFinished = sessionStorage.getItem("promo_completed")
    if (hasFinished === "true") {
      setIsVisible(false)
      return
    }

    if (window.innerWidth < 768) {
      return
    }

    setIsVisible(true)
    // Define uma flag global para indicar que o anúncio foi exibido
    if (typeof window !== 'undefined') (window as any).adWasShown = true

    const handleVisibilityChange = () => {
      if (document.hidden) {
        videoRef.current?.pause()
      } else {
        videoRef.current?.play().catch(() => {})
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    const skipTimer = setTimeout(() => {
      setCanSkip(true)
    }, 10000)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearTimeout(skipTimer)
    }
  }, [])

  const handleVideoEnd = () => {
    sessionStorage.setItem("promo_completed", "true")
    setIsVisible(false)
  }


  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[99999] bg-[#050505] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="max-w-5xl w-full relative flex flex-col items-center">
        <div 
          className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl group cursor-pointer"
          onClick={() => window.open(redirectUrl, "_blank")}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            playsInline
            autoPlay 
            muted={isMuted}
            onEnded={handleVideoEnd}
            disablePictureInPicture 
            controlsList="nodownload" 
          />
          
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 transform scale-95 group-hover:scale-100 transition-transform">
              Saber mais <ExternalLink size={20} />
            </div>
          </div>

          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/60 p-2 rounded-full" onClick={(e) => e.stopPropagation()}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setVolume(v)
                if (videoRef.current) videoRef.current.volume = v
              }}
              className="w-16 h-1 accent-white cursor-pointer"
            />
            <button onClick={(e) => {
              e.stopPropagation()
              setIsMuted(!isMuted)
              if (videoRef.current) videoRef.current.muted = !isMuted
            }} className="text-white">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

          {canSkip && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleVideoEnd()
              }}
              className="absolute bottom-4 right-4 z-30 bg-white text-black px-4 py-2 rounded-md font-bold flex items-center gap-2 hover:bg-gray-200 transition-all"
            >
              Pular Vídeo <SkipForward size={20} />
            </button>
          )}
        </div>

        <div className="mt-8 text-center space-y-2 select-none">
          <p className="text-white/80 text-lg font-medium">
            O conteúdo será liberado após o vídeo...
          </p>
          <p className="text-amber-500 font-bold text-xs uppercase tracking-[0.2em]">
            Atenção: não minimize a página
          </p>
        </div>
      </div>
    </div>
  )
}