"use client"

import { useState, useEffect, useRef } from "react"
import { ExternalLink, Volume2, VolumeX, SkipForward } from "lucide-react"

interface AdPropagandaProps {
  videoSrc: string
  redirectUrl: string
}

export default function AdPropaganda({ videoSrc, redirectUrl }: AdPropagandaProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.1)
  const [canSkip, setCanSkip] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    const storedUser = localStorage.getItem("faceit_user")
    
    if (storedUser && !isLocalhost) {
      try {
        const user = JSON.parse(storedUser)
        const adminLevel = user.Admin
        if (adminLevel && adminLevel >= 1 && adminLevel <= 5) {
          setIsVisible(false)
          return
        }
      } catch (e) {
      }
    }

    let viewCount = parseInt(localStorage.getItem("ultimo_ad_visto") || "0")
    if (isNaN(viewCount)) viewCount = 0
    
    viewCount++
    localStorage.setItem("ultimo_ad_visto", viewCount.toString())

    if (viewCount < 3) {
      setIsVisible(false)
      return
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
      videoRef.current.volume = 0.1
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true
          setIsMuted(true)
          videoRef.current.play().catch(() => {})
        }
      })
    }

    let skipTimer: any

    if (viewCount >= 3) {
      skipTimer = setTimeout(() => {
        setCanSkip(true)
      }, 10000)
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (skipTimer) clearTimeout(skipTimer)
    }
  }, [])

  const handleVideoEnd = () => {
    localStorage.setItem("ultimo_ad_visto", "0")
    setIsVisible(false)
  }

  const handleClick = () => {
    window.open(redirectUrl, "_blank")
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false
        setIsMuted(false)
      } else if (newVolume === 0 && !isMuted) {
        videoRef.current.muted = true
        setIsMuted(true)
      }
    }
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newMuted = !isMuted
    setIsMuted(newMuted)
    if (videoRef.current) {
      videoRef.current.muted = newMuted
      if (!newMuted && volume === 0) {
        setVolume(0.1)
        videoRef.current.volume = 0.1
      }
    }
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
            preload="auto"
            onEnded={handleVideoEnd}
          />
          
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-gold/90 text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 transform scale-95 group-hover:scale-100 transition-transform">
              Visitar Site <ExternalLink size={20} />
            </div>
          </div>

          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/50 p-2 rounded-full hover:bg-black/70 transition-colors" onClick={(e) => e.stopPropagation()}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold"
            />
            <button
              onClick={toggleMute}
              className="text-white"
            >
              {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
          </div>

          {canSkip && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleVideoEnd()
              }}
              className="absolute bottom-4 right-4 z-30 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-white/20 transition-all animate-in fade-in"
            >
              Pular Anúncio <SkipForward size={20} />
            </button>
          )}
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-gold text-xl font-bold animate-pulse">
            O site será exibido ao final do anúncio...
          </p>
          <p className="text-red-500 font-bold text-sm uppercase tracking-wider">
            Não saia da página ou minimize para o anúncio terminar
          </p>
          <p className="text-gray-500 text-sm">
            Clique no vídeo para saber mais
          </p>
        </div>
      </div>
    </div>
  )
}
