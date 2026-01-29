'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Callback() {
  const params = useSearchParams()
  const router = useRouter()
  const executed = useRef(false)

  useEffect(() => {
    if (executed.current) return
    executed.current = true

    const code = params.get('code')
    const codeVerifier = localStorage.getItem('faceit_code_verifier')

    if (!code || !codeVerifier) {
      console.error('Código ou verifier ausentes')
      router.push('/')
      return
    }

    const run = async () => {
      try {
        const res = await fetch('/api/auth/faceit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, codeVerifier }),
        })

        if (!res.ok) throw new Error('Falha na troca do token')

        const user = await res.json()
        
        localStorage.setItem('faceit_user', JSON.stringify(user))
        

        if (window.opener) {
          window.opener.postMessage({ faceitUser: user }, window.location.origin)
          
          window.opener.dispatchEvent(new Event('faceit_auth_updated'))
          
          localStorage.removeItem('faceit_code_verifier')
          window.close() 
        } else {
          window.location.replace('/')
        }

      } catch (err) {
        console.error(err)
        router.push('/')
      }
    }

    run()
  }, [params, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white gap-4">
      <Loader2 className="animate-spin text-[#FF5500]" size={40} />
      <p className="text-lg font-medium">Sincronizando com FACEIT...</p>
    </div>
  )
}