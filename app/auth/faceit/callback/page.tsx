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
        const tokenRes = await fetch('/api/auth/faceit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, codeVerifier }),
        })

        if (!tokenRes.ok) throw new Error('Falha na troca do token')

        const tokenData = await tokenRes.json()
        const accessToken = tokenData.access_token

        // 2️⃣ busca o perfil do usuário na Faceit
        const profileRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!profileRes.ok) throw new Error('Falha ao buscar perfil')
        const profile = await profileRes.json()

        // 3️⃣ monta user parcial
        const partialUser = {
          faceit_guid: profile.sub,
          nickname: profile.nickname || profile.given_name || 'Usuário',
          avatar: profile.picture || '',
          accessToken,
          steam_id_64: profile.steam_id_64,
        }


        // 4️⃣ envia para o backend para pegar ID e Admin
        const dbRes = await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guid: partialUser.faceit_guid,
            nickname: partialUser.nickname,
            avatar: partialUser.avatar,
          }),
        })

        if (!dbRes.ok) throw new Error('Falha ao sincronizar com o banco')
        const dbUser = await dbRes.json()

        // 5️⃣ monta user completo
        const fullUser = {
          ...partialUser,
          id: dbUser.id ?? dbUser.ID,
          Admin: dbUser.Admin,
          admin: dbUser.admin,
        }

        // 6️⃣ salva no localStorage
        localStorage.setItem('faceit_user', JSON.stringify(fullUser))
        localStorage.removeItem('faceit_code_verifier')

        // log success before leaving the page or closing the popup; ensures
        // the request isn't aborted by navigation.
        try {
          console.log('sending login-log', {
            nickname: fullUser.nickname,
            faceit_guid: fullUser.faceit_guid,
          });
          const logUrl = window.location.origin + '/api/logins';
          const logRes = await fetch(logUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nickname: fullUser.nickname,
              faceit_guid: fullUser.faceit_guid,
              success: true,
            }),
          });
          if (!logRes.ok) {
            console.error('login-log endpoint returned', await logRes.text());
          } else {
            const info = await logRes.json();
            console.log('login-log response', info);
          }
        } catch (e) {
          console.error('Failed to send success log', e);
        }

        // 7️⃣ fecha popup ou redireciona
        if (window.opener) {
          window.opener.postMessage({ type: 'FACEIT_LOGIN_SUCCESS', user: fullUser }, window.location.origin)
          setTimeout(() => window.close(), 300)
        } else {
          router.push('/')
        }
      } catch (err) {
        console.error(err)
        // send failure log
        try {
          await fetch(window.location.origin + '/api/logins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nickname: null,
              faceit_guid: null,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          })
        } catch (e) {
          console.error('Failed to send failure log', e)
        }
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
