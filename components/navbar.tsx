'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown, Radio } from 'lucide-react'
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

const Navbar = ({ user, onAuthChange }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [liveMatches, setLiveMatches] = useState<any[]>([])
  const [liveMatchesLoading, setLiveMatchesLoading] = useState(true)
  
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(user)

  const syncUserFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem('faceit_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setCurrentUser(prev => prev?.faceit_guid !== parsed.faceit_guid ? parsed : prev)
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

  const handleLocalAuthChange = () => {
    syncUserFromStorage()
    onAuthChange()
  }

  const openLiveMatchesModal = () => {
    window.dispatchEvent(new CustomEvent('openLiveMatchesModal'))
  }

  const hasLiveMatches = liveMatches.length > 0
  const isAdmin = currentUser?.Admin && currentUser.Admin >= 1 && currentUser.Admin <= 5

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
              <NavLink href="/regras">Regras</NavLink>
              <NavLink href="/campeonato">Campeonato</NavLink>
              
              <div className="relative group">
                <button className="flex items-center gap-1 text-gold font-bold px-4 py-2 rounded-xl border border-gold/50 hover:bg-gold/10 transition-all whitespace-nowrap text-sm xl:text-base">
                  Querido Draft <ChevronDown size={14} />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#060D15]/95 backdrop-blur-xl border border-gold/20 rounded-xl overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top flex flex-col p-1">
                  <DropdownLink href="/times">Times</DropdownLink>
                  <DropdownLink href="/stats">Estatísticas</DropdownLink>
                  <DropdownLink href="/classificacao">Classificação</DropdownLink>
                  <DropdownLink href="/rodadas">Rodadas</DropdownLink>
                  <DropdownLink href="/redondo">Redondo</DropdownLink>
                  <DropdownLink href="/players">Jogadores</DropdownLink>
                  <DropdownLink href="/premiacao">Premiação</DropdownLink>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-none flex items-center gap-6 md:gap-8 relative z-10">
            <div className="hidden md:flex items-center gap-6 md:gap-8">
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
            <NavLink href="/regras">Regras</NavLink>
            <NavLink href="/campeonato">Campeonato</NavLink>
            
            <div className="my-2 border-t border-white/10 pt-4 pb-2 bg-white/5 rounded-xl px-2">
              <p className="px-2 text-xs font-bold text-gold uppercase tracking-widest mb-2 text-center">Querido Draft</p>
              <div className="grid grid-cols-2 gap-2">
                <MobileGridLink href="/times">Times</MobileGridLink>
                <MobileGridLink href="/stats">Estatísticas</MobileGridLink>
                <MobileGridLink href="/classificacao">Classificação</MobileGridLink>
                <MobileGridLink href="/rodadas">Rodadas</MobileGridLink>
                <MobileGridLink href="/redondo">Redondo</MobileGridLink>
                <MobileGridLink href="/players">Jogadores</MobileGridLink>
                <MobileGridLink href="/premiacao">Premiação</MobileGridLink>
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
