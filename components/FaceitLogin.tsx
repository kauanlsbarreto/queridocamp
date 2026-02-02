'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { UserProfile } from './user-profile'

const FaceitLogin = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const syncUser = useCallback(async (incomingUser?: any) => {
    let parsedUser = incomingUser

    if (!parsedUser) {
      const stored = localStorage.getItem('faceit_user')
      if (stored) parsedUser = JSON.parse(stored)
    }

    if (!parsedUser?.faceit_guid) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guid: parsedUser.faceit_guid,
          nickname: parsedUser.nickname,
          avatar: parsedUser.avatar,
        }),
      })

      if (!res.ok) throw new Error('Erro ao sincronizar player')

      const dbUser = await res.json()

      const finalUser: UserProfile = {
        id: dbUser.id,
        faceit_guid: dbUser.faceit_guid,
        nickname: dbUser.nickname,
        avatar: dbUser.avatar,
        steam_id_64: parsedUser.steam_id_64,
        accessToken: parsedUser.accessToken,
        Admin: dbUser.Admin,
        admin: dbUser.admin,
      }

      localStorage.setItem('faceit_user', JSON.stringify(finalUser))
      setUser(finalUser)
    } catch (err) {
      console.error('Erro ao sincronizar:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    syncUser()

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FACEIT_LOGIN_SUCCESS') {
        syncUser(event.data.user)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [syncUser])

  const handleLogout = () => {
    localStorage.removeItem('faceit_user')
    localStorage.removeItem('faceit_code_verifier')
    setUser(null)
  }

  if (loading) {
    return <div className="w-10 h-10 animate-pulse bg-white/10 rounded-full" />
  }

  return (
    <div className="flex items-center">
      {user ? (
        <UserProfile {...user} onLogout={handleLogout} />
      ) : (
        <motion.button
          onClick={() => window.open('/faceit/login', 'FaceitLogin', 'width=600,height=700')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-[#FF5500] text-white px-4 py-2 rounded-xl font-bold"
        >
          <img src="https://cdn.simpleicons.org/faceit/white" className="w-5 h-5" />
          Login Faceit
        </motion.button>
      )}
    </div>
  )
}

export default FaceitLogin
