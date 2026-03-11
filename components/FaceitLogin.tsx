'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { UserProfile, type UserProfile as UserProfileType } from './user-profile'

interface FaceitLoginProps {
  user: UserProfileType | null
  onAuthChange: () => void
}

const FaceitLogin = ({ user, onAuthChange }: FaceitLoginProps) => {

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'FACEIT_LOGIN_SUCCESS') return

      const newUser = event.data.user

      localStorage.setItem('faceit_user', JSON.stringify(newUser))
      
        window.dispatchEvent(new Event('faceit_auth_updated'))
      
      onAuthChange()

      // store login timestamp (used by logout-all feature)
      localStorage.setItem('faceit_user_login_time', Date.now().toString())

      window.location.reload()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onAuthChange])

  const handleLogin = async () => {
    const clientId = '6f737cca-6960-4f17-9493-4ff66340dd9b'
    const redirectUri = 'https://queridocamp.com.br/auth/faceit/callback'
    const codeVerifier = crypto.randomUUID()
    localStorage.setItem('faceit_code_verifier', codeVerifier)

    const codeChallenge = await (async () => {
      const data = new TextEncoder().encode(codeVerifier)
      const digest = await crypto.subtle.digest('SHA-256', data)
      return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    })()

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
    localStorage.removeItem('faceit_user_login_time')
    window.dispatchEvent(new Event('faceit_auth_updated'))
    onAuthChange()
  }

  // whenever the component mounts or the user prop changes we should
  // check if an administrator has triggered a "logout all" event. the
  // server exposes the last logout-all timestamp and we compare it against
  // the last time this particular client logged in. if the server value is
  // newer we immediately clear the session and reload.
  useEffect(() => {
    const checkLogoutAll = async () => {
      try {
        const lastLogin = Number(localStorage.getItem('faceit_user_login_time') || '0')
        const res = await fetch('/api/admin/logout-all')
        if (res.ok) {
          const data = await res.json()
          const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0
          if (ts > lastLogin) {
            handleLogout()
          }
        }
      } catch (err) {
        console.error('Failed to check logout-all status', err)
      }
    }

    checkLogoutAll()
  }, [user])

  return (
    <div className="flex items-center">
      {user ? (
        <UserProfile {...user} onLogout={handleLogout} />
      ) : (
        <motion.button
          onClick={handleLogin}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-[#FF5500] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#ff6a22] transition-colors"
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
