'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { useRouter } from 'next/navigation'
import { useToast } from './hooks/use-toast'
import { Loader, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface UpdateResult {
  name: string
  status: 'success' | 'error'
  message: string
}

export function UpdateDataButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<UpdateResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const handleUpdate = async () => {
    setIsLoading(true)
    setResults([]) 
    setError(null)
    setIsOpen(true) 

    try {
      const storedUser = localStorage.getItem('faceit_user')
      if (!storedUser) throw new Error('Sessão não encontrada. Faça login novamente.')

      const userData = JSON.parse(storedUser)
      let accessToken = userData.accessToken || userData.access_token

      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        accessToken = 'local-dev-token'
      }

      if (!accessToken) throw new Error('Token de acesso ausente.')

      const response = await fetch('/api/admin/update-data', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ faceit_guid: userData.faceit_guid })
      })

      const data = await response.json()

      if (response.ok) {
        if (data.results) {
          setResults(data.results)
        } else {
          toast({ title: 'Sucesso!', description: 'Dados atualizados.' })
          setIsOpen(false)
        }
        router.refresh()
      } else {
        if (response.status === 403 || response.status === 401) {
          localStorage.removeItem('faceit_user')
          window.dispatchEvent(new Event('faceit_auth_updated'))
          throw new Error('Sessão expirada. Por favor, faça login novamente.')
        }
        throw new Error(data.message || 'Erro ao atualizar.')
      }
    } catch (error) {
      const msg = (error as Error).message
      setError(msg)
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button onClick={handleUpdate} disabled={isLoading} variant="outline" size="icon" className="border-gold text-gold hover:bg-gold hover:text-black">
        {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-gray-900 border-gold/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gold">Status da Atualização</DialogTitle>
            <DialogDescription className="text-gray-400">
              {isLoading ? "Processando..." : "Resultado das revalidações:"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoading && results.length === 0 && (
               <div className="flex flex-col items-center py-8 space-y-4">
                  <Loader className="h-8 w-8 text-gold animate-spin" />
                  <p className="text-sm text-gray-400">Sincronizando páginas...</p>
               </div>
            )}
            {error && <div className="p-3 bg-red-900/20 border border-red-500/20 text-red-400 text-sm rounded-lg">{error}</div>}
            <div className="space-y-2">
              {results.map((res, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                  <span className="font-medium">{res.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${res.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{res.message}</span>
                    {res.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}