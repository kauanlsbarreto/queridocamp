'use client'

import { useState, useCallback, useEffect } from 'react'
import Navbar from './navbar'
import type { UserProfile } from './user-profile'

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

    const handler = () => syncUserFromStorage()
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
