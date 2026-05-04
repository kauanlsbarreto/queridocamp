"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Instagram, Twitch } from "lucide-react"
import { motion } from "framer-motion"

const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-black to-gray-900 pt-16 pb-8 border-t border-gold/10">
      <div className="container mx-auto px-4">
        {/* Sponsors removidos */}

        <div className="h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent mb-16" />

        {/* --- CONTEÚDO PRINCIPAL DO FOOTER --- */}
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
              <SocialLink href="https://chat.whatsapp.com/FP1Yw496rNS6pqY1t5lRnP" icon={<WhatsAppIcon size={20} />} />
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
              <li>
                <a href="/regras.pdf" download="regras-querido-camp.pdf" className="text-gray-300 hover:text-gold transition-colors">
                  Regras
                </a>
              </li>
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
                  href="https://chat.whatsapp.com/FP1Yw496rNS6pqY1t5lRnP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-green-600/20 hover:bg-green-600/30 text-green-400 font-medium py-2 px-4 rounded-md transition-colors border border-green-600/30"
                >
                  Entrar no WhatsApp
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

const WhatsAppIcon = ({ size }: { size: number }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488" />
    </svg>
  )
}

export default Footer