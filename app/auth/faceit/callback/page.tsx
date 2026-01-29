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

    const run = async () => {
      // Pequeno delay para garantir que o localStorage esteja disponível no Popup
      await new Promise(resolve => setTimeout(resolve, 500));

      const code = params.get('code')
      const code_verifier = localStorage.getItem('faceit_code_verifier')

      console.log('DEBUG CALLBACK:', { code: !!code, verifier: !!code_verifier });

      if (!code || !code_verifier) {
        console.error('Código ou verifier ausentes no localStorage')
        // Se falhar, tentamos avisar a janela pai antes de redirecionar
        if (window.opener) {
            setTimeout(() => window.close(), 3000);
        }
        router.push('/')
        return
      }

      try {
        const res = await fetch('/api/auth/faceit', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ code, code_verifier }), 
        })

        if (!res.ok) {
          const errorData = await res.json()
          console.error('Erro detalhado da API:', errorData)
          throw new Error('Falha na troca do token')
        }

        const user = await res.json()
        localStorage.setItem('faceit_user', JSON.stringify(user))

        if (window.opener) {
          // 1. Atualiza os dados na janela principal
          window.opener.postMessage({ faceitUser: user }, window.location.origin)
          
          // 2. Notifica componentes como o Navbar
          window.opener.dispatchEvent(new Event('faceit_auth_updated'))
          
          // 3. Pega a URL de retorno
          const returnUrl = localStorage.getItem('faceit_return_url') || '/'
          
          // 4. Limpa e redireciona a janela pai
          localStorage.removeItem('faceit_code_verifier')
          localStorage.removeItem('faceit_return_url')
          
          window.opener.location.href = returnUrl
          window.close() 
        } else {
          window.location.replace('/')
        }

      } catch (err) {
        console.error('Erro no processo de callback:', err)
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