'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import FaceitLogin from './FaceitLogin'
import { Notifications } from './notifications'
import { UserProfile } from './user-profile'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)

  const syncUser = useCallback(() => {
    if (typeof window === 'undefined') return
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setCurrentUser(parsedUser)
      } catch (e) {
        console.error('Erro ao analisar dados do usuário do localStorage', e)
        setCurrentUser(null)
      }
    } else {
      setCurrentUser(null)
    }
  }, [])

  useEffect(() => {
    syncUser()

    window.addEventListener('faceit_auth_updated', syncUser)
    window.addEventListener('storage', syncUser)

    return () => {
      window.removeEventListener('faceit_auth_updated', syncUser)
      window.removeEventListener('storage', syncUser)
    }
  }, [syncUser])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleAuthChange = () => {
    syncUser()
  }

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
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex-none">
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

          {/* Links Desktop */}
          <div className="flex-1 hidden lg:flex justify-center">
            <div className="flex space-x-1 items-center glass-gold rounded-2xl px-6 py-2">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/galeria">Galeria</NavLink>
              <NavLink href="/regras">Regras</NavLink>
              <NavLink href="/campeonato">Campeonato</NavLink>
              <NavLink href="/times">Times</NavLink>
              <NavLink href="/stats">Estatísticas</NavLink>
              <NavLink href="/classificacao">Classificação</NavLink>
              <NavLink href="/rodadas">Rodadas</NavLink>
              <NavLink href="/redondo">Redondo</NavLink>
              <NavLink href="/players">Jogadores</NavLink>
              <NavLink href="/premiacao">Premiação</NavLink>
            </div>
          </div>

          <div className="flex-none flex items-center gap-6 md:gap-8">
            <div className="hidden md:flex items-center gap-6 md:gap-8">
              <Notifications />
              <div className="pl-2">
                <FaceitLogin user={currentUser} onAuthChange={handleAuthChange} />
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
            <NavLink href="/times">Times</NavLink>
            <NavLink href="/stats">Estatísticas</NavLink>
            <NavLink href="/classificacao">Classificação</NavLink>
            <NavLink href="/rodadas">Rodadas</NavLink>
            <NavLink href="/players">Jogadores</NavLink>
            <NavLink href="/redondo">Redondo</NavLink>
            <NavLink href="/premiacao">Premiação</NavLink>

            <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/10">
              <Notifications />
              <FaceitLogin user={currentUser} onAuthChange={handleAuthChange} />
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

export default Navbar