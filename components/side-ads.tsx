"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const ads = [
  {
    id: 1,
    image: "https://i.ibb.co/G34t47Lg/image.png",
    link: "https://neshastore.com",
    alt: "Nesha Store"
  },
  {
    id: 2,
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHOcil8lrrsAzR02hJ5eaNW22E1oeYG_rJWQ&s", 
    link: "https://industriaradiante.com.br/",
    alt: "Radiante"
  },
  {
    id: 3,
    image: "https://i.postimg.cc/HsW9dZ2b/BOXX-LOGO.png", 
    link: "https://www.instagram.com/boxxaju/",
    alt: "Boxx"
  }
]

export default function SideAds() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <aside className="fixed left-8 top-1/2 -translate-y-1/2 z-30 hidden 2xl:flex flex-col gap-4 w-[300px]">
        <AdItem ad={ads[currentIndex]} />
      </aside>

      <aside className="fixed right-8 top-1/2 -translate-y-1/2 z-30 hidden 2xl:flex flex-col gap-4 w-[300px]">
        <AdItem ad={ads[currentIndex]} />
      </aside>
    </>
  )
}

function AdItem({ ad }: { ad: typeof ads[0] }) {
  return (
    <AnimatePresence mode="wait">
      <motion.a
        key={ad.id}
        href={ad.link}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6 }}
        className="block w-full hover:brightness-110 transition-all duration-300"
      >
        <img
          src={ad.image}
          alt={ad.alt}
          className="w-full h-auto rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5"
        />
      </motion.a>
    </AnimatePresence>
  )
}