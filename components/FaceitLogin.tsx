'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { UserProfile, type UserProfile as UserProfileType } from './user-profile'

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  return Array.from({ length }, () =>
    possible.charAt(Math.floor(Math.random() * possible.length))
  ).join('')
}

const generateCodeChallenge = async (codeVerifier: string) => {
  const data = new TextEncoder().encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const FaceitLogin = () => {
  const [user, setUser] = useState<UserProfileType | null>(null)
  const [loading, setLoading] = useState(true)

  // sincroniza com o banco de dados
  const syncUser = useCallback(async (rawUser: any) => {
    if (!rawUser?.faceit_guid) return

    setLoading(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guid: rawUser.faceit_guid,
          nickname: rawUser.nickname,
          avatar: rawUser.avatar,
        }),
      })

      if (!res.ok) throw new Error('Erro ao sincronizar player')

      const dbUser = await res.json()

      const finalUser: UserProfileType = {
        id: dbUser.id ?? dbUser.ID,
        faceit_guid: dbUser.faceit_guid,
        nickname: dbUser.nickname,
        avatar: dbUser.avatar,
        accessToken: rawUser.accessToken,
        Admin: dbUser.Admin,
        admin: dbUser.admin,
      }

      localStorage.setItem('faceit_user', JSON.stringify(finalUser))
      setUser(finalUser)

      // recarrega a página para sumir com o botão
      window.location.reload()
    } catch (err) {
      console.error('Erro sync:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // verifica localStorage ou recebe evento do popup
  useEffect(() => {
    const session = localStorage.getItem('faceit_user')
    if (session) {
      setUser(JSON.parse(session))
      setLoading(false)
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'FACEIT_LOGIN_SUCCESS') return

      syncUser(event.data.user)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [syncUser])

  const handleLogin = async () => {
    const clientId = '6f737cca-6960-4f17-9493-4ff66340dd9b'
    const redirectUri = 'https://queridocamp.com.br/auth/faceit/callback'

    const codeVerifier = generateRandomString(128)
    localStorage.setItem('faceit_code_verifier', codeVerifier)

    const codeChallenge = await generateCodeChallenge(codeVerifier)

    const url = new URL('https://accounts.faceit.com/accounts/dialog/oauth')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('scope', 'openid email profile')

    window.open(url.toString(), 'FaceitLogin', 'width=600,height=700')
  }

  const handleLogout = () => {
    localStorage.removeItem('faceit_user')
    localStorage.removeItem('faceit_code_verifier')
    setUser(null)
    window.location.reload()
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
          onClick={handleLogin}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-[#FF5500] text-white px-4 py-2 rounded-xl font-bold"
        >
          <img
            src="https://cdn.simpleicons.org/faceit/white"
            className="w-5 h-5"
            alt="Faceit"
          />
          Login Faceit
        </motion.button>
      )}
    </div>
  )
}

export default FaceitLogin
