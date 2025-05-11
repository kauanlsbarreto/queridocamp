"use client"

import type React from "react"

import Link from "next/link"
import Image from "next/image"
import { Instagram, Twitch, MessageCircle } from "lucide-react"
import { motion } from "framer-motion"

const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-black to-gray-900 pt-16 pb-8 border-t border-gold/10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="md:col-span-2"
          >
            <div className="flex items-center mb-6">
              <Image src="/images/logo.png" alt="Querido Camp Logo" width={60} height={60} className="mr-3" />
              <span className="text-gold font-bold text-2xl">QUERIDO CAMP</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              O maior campeonato de Counter-Strike 2 de Sergipe. Junte-se a nós e faça parte dessa história de
              competição, paixão e evolução do cenário de esports.
            </p>
            <div className="flex space-x-5">
              <SocialLink href="https://www.instagram.com/querido_camp/" icon={<Instagram size={20} />} />
              <SocialLink href="https://www.twitch.tv/queridocamp" icon={<Twitch size={20} />} />
              <SocialLink href="https://discord.gg/R3PuQdYH" icon={<MessageCircle size={20} />} />
              <SocialLink href="https://www.faceit.com/en/inv/bRDvGfX" icon={<GamepadIcon size={20} />} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="text-white font-bold text-lg mb-6 border-b border-gold/20 pb-2">Links Rápidos</h3>
            <ul className="space-y-3">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/galeria">Galeria</FooterLink>
              <FooterLink href="/regras">Regras</FooterLink>
              <FooterLink href="/campeonato">Campeonato</FooterLink>
              <FooterLink href="/premiacao">Premiação</FooterLink>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-white font-bold text-lg mb-6 border-b border-gold/20 pb-2">Contato</h3>
            <ul className="space-y-3">
              <li className="text-gray-300 hover:text-gold transition-colors">
                <a href="mailto:queridocamp@gmail.com">queridocamp@gmail.com</a>
              </li>
              <li className="text-gray-300">Sergipe, Brasil</li>
              <li className="mt-6">
                <a
                  href="https://discord.gg/R3PuQdYH"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-gold/10 hover:bg-gold/20 text-gold font-medium py-2 px-4 rounded-md transition-colors border border-gold/20"
                >
                  Entrar no Discord
                </a>
              </li>
              <li className="mt-3">
                <a
                  href="https://www.faceit.com/en/inv/bRDvGfX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-gold/10 hover:bg-gold/20 text-gold font-medium py-2 px-4 rounded-md transition-colors border border-gold/20"
                >
                  Hub FACEIT Sergipe
                </a>
              </li>
            </ul>
          </motion.div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400">&copy; {new Date().getFullYear()} Querido Camp. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

const SocialLink = ({ href, icon }: { href: string; icon: React.ReactNode }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gray-400 hover:text-gold transition-colors bg-black/30 p-2 rounded-full hover:bg-black/50"
    >
      {icon}
    </a>
  )
}

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <li>
      <Link href={href} className="text-gray-300 hover:text-gold transition-colors">
        {children}
      </Link>
    </li>
  )
}

// Ícone personalizado para FACEIT
const GamepadIcon = ({ size }: { size: number }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="12" x2="10" y2="12"></line>
      <line x1="8" y1="10" x2="8" y2="14"></line>
      <rect x="2" y="6" width="20" height="12" rx="2"></rect>
      <circle cx="14" cy="12" r="2"></circle>
      <circle cx="18" cy="10" r="1"></circle>
    </svg>
  )
}

export default Footer
