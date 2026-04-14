'use client'

import { useState, useCallback, useEffect } from 'react'
import Navbar from './navbar'
import type { UserProfile } from './user-profile'

const LOCALHOST_SKIP_AUTOLOGIN_KEY = 'localhost_skip_auto_login_once'

export default function NavbarClient() {
  const [user, setUser] = useState<UserProfile | null>(null)

  const syncUserFromStorage = useCallback(() => {
    const stored = localStorage.getItem('faceit_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        setUser(null)
      }
    } else {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    syncUserFromStorage()

    const handler = () => {
      syncUserFromStorage()

      // Qualquer logout que limpar faceit_user e disparar faceit_auth_updated
      // deve forcar um refresh completo para evitar UI stale na pagina atual.
      const hasSession = Boolean(localStorage.getItem('faceit_user'))
      if (!hasSession) {
        if (window.location.hostname === 'localhost') {
          sessionStorage.setItem(LOCALHOST_SKIP_AUTOLOGIN_KEY, '1')
        }
        window.location.reload()
      }
    }
    window.addEventListener('faceit_auth_updated', handler)
    window.addEventListener('storage', handler)

    return () => {
      window.removeEventListener('faceit_auth_updated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [syncUserFromStorage])

  return (
    <Navbar
      user={user}
      onAuthChange={syncUserFromStorage}
    />
  )
}
