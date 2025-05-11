"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface CountdownProps {
  targetDate: Date
}

const CountdownTimer = ({ targetDate }: CountdownProps) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime()

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className="flex flex-wrap justify-center gap-4 md:gap-8">
      <TimeUnit value={timeLeft.days} label="Dias" delay={0} />
      <TimeUnit value={timeLeft.hours} label="Horas" delay={0.1} />
      <TimeUnit value={timeLeft.minutes} label="Minutos" delay={0.2} />
      <TimeUnit value={timeLeft.seconds} label="Segundos" delay={0.3} />
    </div>
  )
}

const TimeUnit = ({ value, label, delay }: { value: number; label: string; delay: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col items-center"
    >
      <div className="bg-black/70 backdrop-blur-sm border-2 border-gold text-gold text-4xl md:text-5xl font-bold rounded-lg w-24 h-24 flex items-center justify-center shadow-lg shadow-gold/10">
        {value.toString().padStart(2, "0")}
      </div>
      <span className="text-white text-sm mt-2 font-medium">{label}</span>
    </motion.div>
  )
}

export default CountdownTimer
