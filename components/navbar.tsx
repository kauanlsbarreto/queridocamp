"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X, Trophy } from "lucide-react"
import { motion } from "framer-motion"

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
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-black/80 backdrop-blur-md border-b border-gold/10 py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <Trophy className="text-gold mr-2" size={28} />
            <span className="text-gold font-bold text-xl hidden sm:inline">QUERIDO CAMP</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/galeria">Galeria</NavLink>
            <NavLink href="/regras">Regras</NavLink>
            <NavLink href="/campeonato">Campeonato</NavLink>
            <NavLink href="/premiacao">Premiação</NavLink>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-gold" onClick={toggleMenu}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-3 mt-4 bg-black/90 backdrop-blur-md rounded-lg border border-gold/10 p-4">
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
            <MobileNavLink href="/premiacao" onClick={toggleMenu}>
              Premiação
            </MobileNavLink>
          </div>
        )}
      </div>
    </motion.nav>
  )
}

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <Link href={href} className="text-white hover:text-gold transition-colors duration-200 font-medium relative group">
      {children}
      <span className="absolute left-0 bottom-0 w-0 h-0.5 bg-gold transition-all duration-300 group-hover:w-full"></span>
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
      className="block text-white hover:text-gold transition-colors duration-200 py-2 border-b border-gray-800"
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

export default Navbar
