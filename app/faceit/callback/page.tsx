'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface UserProfile {
  nickname: string
  avatar: string
  accessToken: string
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
      
      console.log("Iniciando processo de autenticação...")
      console.log("Code recebido:", code)
      console.log("Code Verifier recuperado:", codeVerifier)

      try {
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
          console.error("Erro na resposta da API interna:", tokenData)
          setError(`Erro no servidor: ${JSON.stringify(tokenData)}`)
          setLoading(false)
          return
        }

        const accessToken = tokenData.access_token
        console.log("Token de acesso obtido com sucesso!")

      const profileRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

        const profileData = await profileRes.json()
        
        if (!profileRes.ok) {
          console.error("Erro ao buscar perfil na Faceit:", profileData)
          setError(`Erro no Perfil: ${JSON.stringify(profileData)}`)
          setLoading(false)
          return
        }

      const user: UserProfile = {
        nickname: profileData.nickname,
        avatar: profileData.avatar || '',
        accessToken
      }

      if (window.opener) {
        window.opener.postMessage({ faceitUser: user }, "*")
        
        setTimeout(() => {
          window.close()
        }, 300)
      } else {
        localStorage.setItem('faceit_user', JSON.stringify(user))
        router.push('/')
      }

        window.localStorage.removeItem('faceit_code_verifier')
        setLoading(false)
      } catch (err) {
        console.error("Erro catastrófico no callback:", err)
        setError('Falha crítica ao autenticar com a Faceit. Verifique o console.')
        setLoading(false)
      }
    }

    const code = searchParams.get('code')
    if (code) {
      fetchTokenAndProfile(code)
    } else {
      const urlError = searchParams.get('error')
      setError(urlError ? `Faceit retornou erro: ${urlError}` : 'Nenhum code fornecido pela Faceit')
      setLoading(false)
    }
  }, [searchParams, router])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-black text-[#FF5500]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF5500]"></div>
        <p className="font-bold">Processando login da Faceit...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <h1 className="text-red-500 text-2xl font-bold mb-4">Erro na Autenticação</h1>
      <pre className="bg-gray-900 p-4 rounded-lg overflow-auto max-w-full text-sm text-gray-300">
        {error}
      </pre>
      <div className="flex gap-4 mt-6">
        <button 
          onClick={() => window.location.reload()}
          className="bg-gray-700 px-6 py-2 rounded-xl font-bold hover:bg-gray-600"
        >
          Tentar Novamente
        </button>
        <button 
          onClick={() => window.close()}
          className="bg-[#FF5500] px-6 py-2 rounded-xl font-bold hover:bg-[#E04B00]"
        >
          Fechar Janela
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white font-bold">
      Login realizado com sucesso! Redirecionando...
    </div>
  )
}

export default FaceitCallback