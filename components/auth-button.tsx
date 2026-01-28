'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import { LogOut, User, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

export default function AuthButton() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const syncUser = () => {
      const saved = localStorage.getItem('faceit_user')
      if (saved) setUser(JSON.parse(saved))
      else setUser(null)
      setLoading(false)
    }

    syncUser()
    window.addEventListener('faceit_auth_updated', syncUser)
    return () =>
      window.removeEventListener('faceit_auth_updated', syncUser)
  }, [])

  const generatePKCE = async () => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let verifier = ''

    for (let i = 0; i < 64; i++) {
      verifier += chars[Math.floor(Math.random() * chars.length)]
    }

    localStorage.setItem('faceit_code_verifier', verifier)

    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier)
    )

    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

const handleLogin = async (e?: React.MouseEvent) => {
  e?.preventDefault()
  e?.stopPropagation()

  if (localStorage.getItem('faceit_login_in_progress')) {
    console.log('[LOGIN] já em progresso')
    return
  }

  localStorage.setItem('faceit_login_in_progress', '1')

  const clientId = process.env.NEXT_PUBLIC_FACEIT_CLIENT_ID!
  const redirectUri = process.env.NEXT_PUBLIC_FACEIT_REDIRECT_URI!

  const challenge = await generatePKCE()
  const state = crypto.randomUUID()

  localStorage.setItem(
    'faceit_return_url',
    window.location.pathname + window.location.search
  )

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    response_mode: 'query',
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'openid profile email',
    state,
  })

  window.location.href =
    `https://accounts.faceit.com/accounts/oauth/authorize?${params.toString()}`
  }


  const handleLogout = () => {
    localStorage.removeItem('faceit_user')
    localStorage.removeItem('faceit_code_verifier')
    setUser(null)
    window.dispatchEvent(new Event('faceit_auth_updated'))
  }

  if (loading) {
    return <div className="w-32 h-10 bg-gray-800 animate-pulse rounded-md" />
  }

  if (!user) {
    return (
      <Button
        type="button"
        onClick={handleLogin}
        className="border-orange-500 bg-black/50 text-white flex gap-2"
        variant="outline"
      >
        <Image src="/images/faceit.png" alt="FACEIT" width={20} height={20} />
        Entrar com FACEIT
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-black/50 text-white">
          <Image
            src={user.avatar}
            alt={user.name}
            width={24}
            height={24}
            className="rounded-full mr-2"
          />
          {user.name}
          <ChevronDown size={14} className="ml-2" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="bg-gray-900 text-white">
        <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/stats?filter=me">
            <User size={16} className="mr-2" />
            Minhas stats
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-400"
        >
          <LogOut size={16} className="mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
