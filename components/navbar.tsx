"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass-gold backdrop-blur-xl border-b border-gold/20 py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 group-hover:scale-110 transition-transform duration-300">
              <Image src="/logo.png" alt="Querido Camp Logo" fill className="object-contain" priority />
            </div>
          </Link>

          <div className="hidden md:flex space-x-1 items-center glass-gold rounded-2xl px-6 py-2">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/galeria">Galeria</NavLink>
            <NavLink href="/regras">Regras</NavLink>
            <NavLink href="/campeonato">Campeonato</NavLink>
            <NavLink href="/classificacao">Classificação</NavLink>
            <NavLink href="/premiacao">Premiação</NavLink>
            <NavLink href="/inscricao">Inscrição</NavLink>
          </div>

          <div className="flex items-center md:hidden">
            <button
              className="glass-gold p-2 rounded-xl text-gold hover:scale-110 transition-transform duration-300"
              onClick={toggleMenu}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden mt-4 glass-gold rounded-2xl p-6 space-y-4"
          >
            <MobileNavLink href="/" onClick={toggleMenu}>
              Home
            </MobileNavLink>
            <MobileNavLink href="/galeria" onClick={toggleMenu}>
              Galeria
            </MobileNavLink>
            <MobileNavLink href="/regras" onClick={toggleMenu}>
              Regras
            </MobileNavLink>
            <MobileNavLink href="/campeonato" onClick={toggleMenu}>
              Campeonato
            </MobileNavLink>
            <MobileNavLink href="/classificacao" onClick={toggleMenu}>
              Classificação
            </MobileNavLink>
            <MobileNavLink href="/premiacao" onClick={toggleMenu}>
              Premiação
            </MobileNavLink>
            <MobileNavLink href="/inscricao" onClick={toggleMenu}>
              Inscrição
            </MobileNavLink>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <Link
      href={href}
      className="text-white/80 hover:text-gold transition-all duration-300 font-medium px-4 py-2 rounded-xl hover:bg-white/5 relative group"
    >
      {children}
      <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gold scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full"></span>
    </Link>
  )
}

const MobileNavLink = ({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
}) => {
  return (
    <Link
      href={href}
      className="block text-white/80 hover:text-gold transition-colors duration-300 py-3 px-4 rounded-xl hover:bg-white/5 border-b border-white/10 last:border-b-0"
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

export default Navbar
