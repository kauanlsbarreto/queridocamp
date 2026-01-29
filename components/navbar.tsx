'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import FaceitLogin from './FaceitLogin'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [authKey, setAuthKey] = useState(0)

useEffect(() => {
  const handleScroll = () => setScrolled(window.scrollY > 50)
  
  const handleAuthUpdate = () => {
    setAuthKey(prev => prev + 1)
  }

  window.addEventListener('scroll', handleScroll)
  window.addEventListener('faceit_auth_updated', handleAuthUpdate)
  window.addEventListener('storage', handleAuthUpdate)

  return () => {
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('faceit_auth_updated', handleAuthUpdate)
    window.removeEventListener('storage', handleAuthUpdate)
  }
}, [])



  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'glass-gold backdrop-blur-xl border-b border-gold/20 py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 group-hover:scale-110 transition-transform duration-300">
              <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
            </div>
          </Link>
          


          <div className="hidden md:flex space-x-1 items-center glass-gold rounded-2xl px-6 py-2">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/galeria">Galeria</NavLink>
            <NavLink href="/regras">Regras</NavLink>
            <NavLink href="/campeonato">Campeonato</NavLink>
            <NavLink href="/times">Times</NavLink>
            <NavLink href="/stats">Estatísticas</NavLink>
            <NavLink href="/classificacao">Classificação</NavLink>
            <NavLink href="/rodadas">Rodadas</NavLink>
            <NavLink href="/redondo">Redondo</NavLink>
            <NavLink href="/premiacao">Premiação</NavLink>
          </div>
          <div className="flex items-center gap-4">
          <div className="ml-8"> 
                <FaceitLogin key={authKey} />
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
            className="md:hidden mt-4 glass-gold rounded-2xl p-6 space-y-4"
          >
            <NavLink href="/">Home</NavLink>
            <NavLink href="/galeria">Galeria</NavLink>
            <NavLink href="/regras">Regras</NavLink>
            <NavLink href="/campeonato">Campeonato</NavLink>
            <NavLink href="/times">Times</NavLink>
            <NavLink href="/stats">Estatísticas</NavLink>
            <NavLink href="/classificacao">Classificação</NavLink>
            <NavLink href="/rodadas">Rodadas</NavLink>
            <NavLink href="/premiacao">Premiação</NavLink>

        <div className="flex items-center gap-4 ml-10 border-l border-white/10 pl-6">
          <FaceitLogin key={authKey} />
        </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}

const NavLink = ({ href, children }: any) => (
  <Link href={href} className="text-white/80 hover:text-gold px-4 py-2 rounded-xl">
    {children}
  </Link>
)

export default Navbar
