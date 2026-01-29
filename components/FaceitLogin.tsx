'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { UserProfile } from './user-profile'

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let text = ''
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

const generateCodeChallenge = async (codeVerifier: string) => {
  if (typeof window === 'undefined' || !window.crypto) return ''
  
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const FaceitLogin = () => {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const syncUser = useCallback(() => {
    if (typeof window === 'undefined') return
    const session = localStorage.getItem('faceit_user')
    if (session) {
      try {
        setUser(JSON.parse(session))
      } catch (e) {
        localStorage.removeItem('faceit_user')
        setUser(null)
      }
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    syncUser()

    const handleMessage = (event: MessageEvent) => {
      // Adicione uma verificação de origem por segurança se possível
      if (event.data && event.data.faceitUser) {
        const userData = event.data.faceitUser
        setUser(userData)
        localStorage.setItem('faceit_user', JSON.stringify(userData))
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('storage', syncUser)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('storage', syncUser)
    }
  }, [syncUser])

  const handleLogout = () => {
    localStorage.removeItem('faceit_user')
    localStorage.removeItem('faceit_token')
    setUser(null)
  }

  const handleLogin = async () => {
    const clientId = '6104e222-cee5-4c67-90c0-035196f28528'
    const redirectUri = 'https://queridocamp.com.br/faceit/callback'

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

    const width = 600
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    
    window.open(url.toString(), 'FaceitLogin', `width=${width},height=${height},top=${top},left=${left}`)
  }

  if (loading) return <div className="w-10 h-10 animate-pulse bg-white/10 rounded-full" />

  return (
    <div className="flex items-center">
      {user ? (
        <UserProfile 
          nickname={user.nickname} 
          avatar={user.avatar} 
          onLogout={handleLogout} 
        />
      ) : (
        <motion.button
          onClick={handleLogin}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-[#FF5500] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#E04B00] transition-colors shadow-lg"
        >
          <div className="relative w-5 h-5">
            <img src="https://cdn.simpleicons.org/faceit/white" alt="Faceit" className="w-full h-full object-contain" />
          </div>
          <span>Login Faceit</span>
        </motion.button>
      )}
    </div>
  )
}

export default FaceitLogin
