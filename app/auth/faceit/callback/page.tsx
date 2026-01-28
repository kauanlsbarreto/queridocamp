'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function Callback() {
  const params = useSearchParams()
  const router = useRouter()
  const executed = useRef(false)

  useEffect(() => {
    if (executed.current) return
    executed.current = true

    const code = params.get('code')
    const code_verifier = localStorage.getItem('faceit_code_verifier')

    if (!code || !code_verifier) {
      router.push('/')
      return
    }

    const run = async () => {
      const res = await fetch('/api/auth/faceit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier }),
      })

      if (!res.ok) {
        router.push('/')
        return
      }

      const user = await res.json()
      localStorage.setItem('faceit_user', JSON.stringify(user))
      window.dispatchEvent(new Event('faceit_auth_updated'))

      const returnUrl =
        localStorage.getItem('faceit_return_url') || '/'
      localStorage.removeItem('faceit_return_url')

      window.location.replace(returnUrl)
    }

    run()
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      Carregando perfil FACEIT...
    </div>
  )
}
