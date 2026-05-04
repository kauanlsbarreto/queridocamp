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

        const profileRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!profileRes.ok) throw new Error('Falha ao buscar perfil')
        const profile = await profileRes.json()

        const partialUser = {
          faceit_guid: profile.sub,
          nickname: profile.nickname || profile.given_name || 'Usuário',
          avatar: profile.picture || '',
          accessToken,
          steam_id_64: profile.steam_id_64,
        }


        const linkPlayerIdRaw = localStorage.getItem('faceit_link_player_id')
        const linkPlayerId = linkPlayerIdRaw ? Number(linkPlayerIdRaw) : null

        const dbRes = await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guid: partialUser.faceit_guid,
            nickname: partialUser.nickname,
            avatar: partialUser.avatar,
            linkPlayerId: Number.isFinite(linkPlayerId as number) ? linkPlayerId : null,
          }),
        })

        if (!dbRes.ok) {
          let message = 'Falha ao sincronizar com o banco'
          try {
            const errData = await dbRes.json()
            if (errData?.message) message = errData.message
          } catch {}
          throw new Error(message)
        }
        const dbUser = await dbRes.json()

        const fullUser = {
          ...partialUser,
          id: dbUser.id ?? dbUser.ID,
          Admin: dbUser.Admin,
          admin: dbUser.admin,
        }

        // Garante steamid no banco já no login (se faltar, busca via API Faceit no backend).
        try {
          const syncRes = await fetch('/api/players/sync-steamid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: fullUser.id,
              faceit_guid: fullUser.faceit_guid,
            }),
          })

          if (syncRes.ok) {
            const syncData = await syncRes.json()
            if (syncData?.steamid && !fullUser.steam_id_64) {
              fullUser.steam_id_64 = syncData.steamid
            }
          }
        } catch {
          // Não bloqueia o login por falha de sincronização de steamid.
        }

        localStorage.setItem('faceit_user', JSON.stringify(fullUser))
        localStorage.removeItem('faceit_link_player_id')
        localStorage.removeItem('faceit_code_verifier')


        if (window.opener) {
          window.opener.postMessage({ type: 'FACEIT_LOGIN_SUCCESS', user: fullUser }, window.location.origin)
          setTimeout(() => window.close(), 300)
        } else {
          router.push('/')
        }
      } catch (err) {
        console.error(err)
        localStorage.removeItem('faceit_link_player_id')
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

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'FACEIT_LOGIN_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
            window.location.origin
          )
          setTimeout(() => window.close(), 500)
          return
        }

        alert(err instanceof Error ? err.message : 'Falha no login Faceit')
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
