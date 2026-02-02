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
      router.push('/')
      return
    }

    const run = async () => {
      try {
        // 1️⃣ troca o code pelo access_token
        const tokenRes = await fetch('/api/auth/faceit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, codeVerifier }),
        })

        if (!tokenRes.ok) throw new Error('Falha na troca do token')

        const tokenData = await tokenRes.json()
        const accessToken = tokenData.access_token

        // 2️⃣ busca o perfil do usuário (ESSENCIAL)
        const profileRes = await fetch(
          'https://api.faceit.com/auth/v1/resources/userinfo',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        if (!profileRes.ok) throw new Error('Falha ao buscar perfil')

        const profile = await profileRes.json()

        // 3️⃣ monta o user FINAL
        const user = {
          faceit_guid: profile.sub,
          nickname: profile.nickname || profile.given_name || 'Usuário',
          avatar: profile.picture || '',
          accessToken,
          steam_id_64: profile.steam_id_64,
        }

        localStorage.removeItem('faceit_code_verifier')

        // 4️⃣ envia para a janela principal
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'FACEIT_LOGIN_SUCCESS',
              user,
            },
            window.location.origin
          )

          setTimeout(() => window.close(), 300)
        } else {
          localStorage.setItem('faceit_user', JSON.stringify(user))
          router.push('/')
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
      <p className="text-lg font-medium">Autenticando...</p>
    </div>
  )
}
