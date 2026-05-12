'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown, Radio, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import FaceitLogin from './FaceitLogin'
import { Button } from './ui/button'
import { Notifications } from './notifications'
import { UserProfile } from './user-profile'
import { UpdateDataButton } from './UpdateDataButton'

interface NavbarProps {
  user: UserProfile | null
  onAuthChange: () => void
}

const VOLUME_STORAGE_KEY = 'site_volume'

const Navbar = ({ user, onAuthChange }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [liveMatches, setLiveMatches] = useState<any[]>([])
  const [liveMatchesLoading, setLiveMatchesLoading] = useState(true)
  const [volume, setVolume] = useState(1)
  const [lastNonZeroVolume, setLastNonZeroVolume] = useState(1)
  
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(user)

  const syncUserFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem('faceit_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setCurrentUser(prev => {
          if (!prev) return parsed
          return JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed
        })
      } catch (e) {
        console.error("Erro ao ler usuário:", e)
        setCurrentUser(null)
      }
    } else {
      if (!user) setCurrentUser(null)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      setCurrentUser(user)
    }
  }, [user])

  useEffect(() => {
    syncUserFromStorage()
  }, [syncUserFromStorage])

  useEffect(() => {
    const handleGlobalAuth = () => {
      syncUserFromStorage()
      onAuthChange() 
    }

    window.addEventListener('faceit_auth_updated', handleGlobalAuth)
    window.addEventListener('storage', handleGlobalAuth)

    const interval = setInterval(() => {
      syncUserFromStorage()
    }, 500)

    return () => {
      window.removeEventListener('faceit_auth_updated', handleGlobalAuth)
      window.removeEventListener('storage', handleGlobalAuth)
      clearInterval(interval)
    }
  }, [syncUserFromStorage, onAuthChange])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleMatchesUpdate = (event: Event) => {
      const customEvent = event as CustomEvent
      setLiveMatches(customEvent.detail.matches || [])
      setLiveMatchesLoading(customEvent.detail.loading)
    }
    window.addEventListener('liveMatchesUpdated', handleMatchesUpdate)

    // Request initial data
    window.dispatchEvent(new CustomEvent('requestLiveMatches'))

    return () => window.removeEventListener('liveMatchesUpdated', handleMatchesUpdate)
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    const parsed = Number(raw)
    const safe = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1
    setVolume(safe)
    if (safe > 0) setLastNonZeroVolume(safe)
  }, [])

  const applyVolume = useCallback((nextVolume: number) => {
    const safe = Math.min(1, Math.max(0, nextVolume))
    setVolume(safe)
    if (safe > 0) setLastNonZeroVolume(safe)
    localStorage.setItem(VOLUME_STORAGE_KEY, String(safe))
    window.dispatchEvent(new CustomEvent('siteVolumeChanged', { detail: { volume: safe } }))
  }, [])

  const toggleMute = () => {
    if (volume <= 0) {
      applyVolume(lastNonZeroVolume > 0 ? lastNonZeroVolume : 1)
      return
    }

    applyVolume(0)
  }

  const handleLocalAuthChange = () => {
    syncUserFromStorage()
    onAuthChange()
  }

  const openLiveMatchesModal = () => {
    window.dispatchEvent(new CustomEvent('openLiveMatchesModal'))
  }

  const hasLiveMatches = liveMatches.length > 0
  const isAdmin = currentUser?.Admin && currentUser.Admin >= 1 && currentUser.Admin <= 5
  const volumePercent = Math.round(volume * 100)

  const showLiveMatchesButton = !liveMatchesLoading && (hasLiveMatches || isAdmin)

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        scrolled
          ? 'glass-gold backdrop-blur-xl border-b border-gold/20 py-2'
          : 'bg-transparent py-4'
      }`}
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="w-full px-6 md:px-12">
        <div className="relative flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex-none relative z-10">
            <Link href="/" className="flex items-center group">
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 group-hover:scale-110 transition-transform duration-300">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex justify-center">
            <div className="flex space-x-1 items-center glass-gold rounded-2xl px-6 py-2">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/galeria">Galeria</NavLink>
              <a
                href="/regras.pdf"
                download="regras-querido-camp.pdf"
                className="text-white/80 hover:text-gold px-3 py-2 rounded-xl transition-colors whitespace-nowrap text-sm xl:text-base"
              >
                Regras
              </a>
              <NavLink href="/campeonato">Campeonato</NavLink>
              <NavLink href="/loja">Loja</NavLink>
              <NavLink href="/players">Jogadores</NavLink>
              <NavLink href="/skins">Skins</NavLink>
              <NavLink href="/alugar-servidor">Servidor</NavLink>
              <div className="relative group">
                <button className="flex items-center gap-1 text-gold font-bold px-4 py-2 rounded-xl border border-gold/50 hover:bg-gold/10 transition-all whitespace-nowrap text-sm xl:text-base cursor-default">
                  Copa Draft<ChevronDown size={14} />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#060D15]/95 backdrop-blur-xl border border-gold/20 rounded-xl overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top flex flex-col p-4 text-center">
                  <DropdownLink href="/copadraft/times">Times</DropdownLink>
                  <DropdownLink href="/copadraft/classificacao">Classificacao</DropdownLink>
                  <DropdownLink href="/copadraft/stats">Estatísticas</DropdownLink>
                  <DropdownLink href="/copadraft/rodadas">Rodadas</DropdownLink>
                  <DropdownLink href="/copadraft/desafiar">Desafiar</DropdownLink>
                  <DropdownLink href="/copadraft/jogos">Jogos</DropdownLink>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-none flex items-center gap-6 md:gap-8 relative z-10">
            <div className="hidden md:flex items-center gap-6 md:gap-8">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-black/30 px-1.5 py-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-zinc-200 hover:text-gold transition-colors"
                  title={volume <= 0 ? 'Ativar som' : 'Silenciar'}
                  aria-label={volume <= 0 ? 'Ativar som' : 'Silenciar'}
                >
                  {volume <= 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volumePercent}
                  onChange={(event) => applyVolume(Number(event.target.value) / 100)}
                  className="h-10 w-3 cursor-pointer accent-gold [writing-mode:vertical-lr] [direction:rtl]"
                  aria-label="Volume do site"
                />
              </div>

              {showLiveMatchesButton && (
                <Button onClick={openLiveMatchesModal} variant="outline" size="icon" className={`border-red-500 text-red-500 hover:bg-red-500 hover:text-white relative ${hasLiveMatches ? 'animate-pulse' : ''}`}>
                  <Radio className="h-5 w-5" />
                  {hasLiveMatches && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                  )}
                </Button>
              )}
              {(currentUser?.Admin === 1 || currentUser?.Admin === 2) && <UpdateDataButton />}
              <Notifications />
              <div className="pl-2">
                <FaceitLogin user={currentUser} onAuthChange={handleLocalAuthChange} />
              </div>
            </div>
            
            <div className="md:hidden">
              <button
                type="button"
                className="glass-gold p-2 rounded-xl text-gold"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-4 glass-gold rounded-2xl p-6 flex flex-col space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <NavLink href="/">Home</NavLink>
            <NavLink href="/galeria">Galeria</NavLink>
            <a
              href="/regras.pdf"
              download="regras-querido-camp.pdf"
              className="text-white/80 hover:text-gold px-3 py-2 rounded-xl transition-colors whitespace-nowrap text-sm xl:text-base"
            >
              Regras
            </a>
            <NavLink href="/campeonato">Campeonato</NavLink>
            <NavLink href="/loja">Loja</NavLink>
            <NavLink href="/players">Jogadores</NavLink>
            <NavLink href="/skins">Skins</NavLink>
            <NavLink href="/alugar-servidor">Servidor</NavLink>
            
            <div className="my-2 border-t border-white/10 pt-4 pb-2 bg-white/5 rounded-xl px-2">
              <p className="px-2 text-xs font-bold text-gold uppercase tracking-widest mb-2 text-center">Copa Draft</p>
              <div className="grid grid-cols-1 gap-2">
                <MobileGridLink href="/copadraft/times">Times</MobileGridLink>
                <MobileGridLink href="/copadraft/classificacao">Classificacao</MobileGridLink>
                <MobileGridLink href="/copadraft/stats">Estatísticas</MobileGridLink>
                <MobileGridLink href="/copadraft/rodadas">Rodadas</MobileGridLink>
                <MobileGridLink href="/copadraft/desafiar">Desafiar</MobileGridLink>
                <MobileGridLink href="/copadraft/jogos">Jogos</MobileGridLink>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/30 px-3 py-2">
              <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-300">Volume do som</div>
              <div className="flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-zinc-200 hover:text-gold transition-colors"
                  title={volume <= 0 ? 'Ativar som' : 'Silenciar'}
                  aria-label={volume <= 0 ? 'Ativar som' : 'Silenciar'}
                >
                  {volume <= 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volumePercent}
                  onChange={(event) => applyVolume(Number(event.target.value) / 100)}
                  className="h-12 w-4 cursor-pointer accent-gold [writing-mode:vertical-lr] [direction:rtl]"
                  aria-label="Volume do site"
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/10">
              {showLiveMatchesButton && (
                <Button onClick={openLiveMatchesModal} variant="outline" size="icon" className={`border-red-500 text-red-500 hover:bg-red-500 hover:text-white relative ${hasLiveMatches ? 'animate-pulse' : ''}`}>
                  <Radio className="h-5 w-5" />
                  {hasLiveMatches && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                  )}
                </Button>
              )}
              {(currentUser?.Admin === 1 || currentUser?.Admin === 2) && <UpdateDataButton />}
              <Notifications />
              <FaceitLogin user={currentUser} onAuthChange={handleLocalAuthChange} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}

const NavLink = ({ href, children }: any) => (
  <Link href={href} className="text-white/80 hover:text-gold px-3 py-2 rounded-xl transition-colors whitespace-nowrap text-sm xl:text-base">
    {children}
  </Link>
)

const DropdownLink = ({ href, children }: any) => (
  <Link href={href} className="block text-white/80 hover:text-gold hover:bg-white/5 px-4 py-2 rounded-lg transition-colors text-sm text-center">
    {children}
  </Link>
)

const MobileGridLink = ({ href, children }: any) => (
  <Link href={href} className="flex items-center justify-center bg-black/40 text-white/80 hover:text-gold hover:bg-black/60 px-2 py-3 rounded-lg transition-colors text-xs font-medium border border-white/5">
    {children}
  </Link>
)

export default Navbar
