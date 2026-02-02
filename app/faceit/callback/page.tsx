'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface UserProfile {
  faceit_guid: string
  nickname: string
  avatar: string
  accessToken: string
  steam_id_64?: string
}

const FaceitCallback = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  useEffect(() => {
    const fetchTokenAndProfile = async (code: string) => {
      if (hasFetched.current) return
      hasFetched.current = true

      const codeVerifier = window.localStorage.getItem('faceit_code_verifier')

      try {
        console.log("Iniciando troca de token via API interna...")

        const tokenRes = await fetch('/api/auth/faceit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code,
            codeVerifier: codeVerifier || ''
          })
        })

        const tokenData = await tokenRes.json()

        if (!tokenRes.ok) {
          console.error("Erro retornado pelo route.ts:", tokenData)
          setError(`Erro no Servidor: ${JSON.stringify(tokenData.error || tokenData)}`)
          setLoading(false)
          return
        }

        const accessToken = tokenData.access_token
        console.log("Token obtido com sucesso!")

        // 2️⃣ Busca os dados do perfil usando o Identity API (mais estável para login)
        const profileRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        })

        const profileData = await profileRes.json()
        
        if (!profileRes.ok) {
          console.error("Erro ao buscar perfil na Faceit:", profileData)
          setError(`Erro ao buscar perfil: ${JSON.stringify(profileData)}`)
          setLoading(false)
          return
        }

        const user: UserProfile = {
          faceit_guid: profileData.sub,
          nickname: profileData.nickname || profileData.given_name || 'Usuário',
          avatar: profileData.picture || profileData.avatar || '',
          accessToken,
          steam_id_64: profileData.steam_id_64
        }

        console.log("Usuário autenticado:", user.nickname)

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'FACEIT_LOGIN_SUCCESS',
              user
            },
            window.location.origin
          )
          setTimeout(() => {
            window.close()
          }, 500)
        } else {
          localStorage.setItem('faceit_user', JSON.stringify(user))
          router.push('/')
        }

        window.localStorage.removeItem('faceit_code_verifier')
      } catch (err: any) {
        console.error("Erro crítico no Callback:", err)
        setError(`Falha na autenticação: ${err.message || 'Erro desconhecido'}`)
        setLoading(false)
      }
    }

    const code = searchParams.get('code')
    if (code) {
      fetchTokenAndProfile(code)
    } else {
      const urlError = searchParams.get('error')
      if (urlError) {
        setError(`A Faceit retornou um erro: ${urlError}`)
      } else {
        setError('Nenhum código de autorização foi encontrado na URL.')
      }
      setLoading(false)
    }
  }, [searchParams, router])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-black text-[#FF5500]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF5500]"></div>
        <p className="font-bold">Sincronizando com a Faceit...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 text-center">
      <h1 className="text-red-500 text-2xl font-bold mb-4">Ops! Algo deu errado</h1>
      <div className="bg-gray-900 p-4 rounded-lg overflow-auto max-w-full text-sm text-gray-300 mb-6 font-mono">
        {error}
      </div>
      <button 
        onClick={() => window.close()}
        className="bg-[#FF5500] px-8 py-3 rounded-xl font-bold hover:bg-[#E04B00] transition-colors"
      >
        Fechar e Tentar Novamente
      </button>
    </div>
  )

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white font-bold">
      Autenticado! Esta janela fechará automaticamente...
    </div>
  )
}

export default FaceitCallback