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
  const { toast } = useToast()
  const router = useRouter()

  const handleUpdate = async () => {
    setIsLoading(true)
    setResults([]) // Limpa resultados anteriores
    setIsOpen(true) // Abre o modal

    try {
      const storedUser = localStorage.getItem('faceit_user')
      if (!storedUser) {
        throw new Error('Você não está logado.')
      }

      const user = JSON.parse(storedUser)
      let accessToken = user?.accessToken

      if (!accessToken) {
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          accessToken = 'local-dev-token'
        } else {
          throw new Error('Token de autenticação não encontrado. Por favor, faça login novamente.')
        }
      }

      const response = await fetch('/api/admin/update-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.results) {
          setResults(data.results)
        } else {
           // Fallback se a API não retornar results detalhados
           toast({
            title: 'Sucesso!',
            description: data.message || 'Dados atualizados.',
            variant: 'default',
          })
          setIsOpen(false)
        }
        router.refresh()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Falha ao atualizar os dados.')
      }
    } catch (error) {
      console.error('Update failed:', error)
      toast({
        title: 'Erro',
        description: (error as Error).message,
        variant: 'destructive',
      })
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleUpdate}
        disabled={isLoading}
        variant="outline"
        size="icon"
        className="border-gold text-gold hover:bg-gold hover:text-black"
        aria-label="Atualizar dados do site"
      >
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-gray-900 border-gold/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gold">Atualização de Dados</DialogTitle>
            <DialogDescription className="text-gray-400">
              {isLoading ? "Processando atualizações..." : "Status da atualização das páginas."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isLoading && results.length === 0 && (
               <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <Loader className="h-8 w-8 text-gold animate-spin" />
                  <p className="text-sm text-gray-400">Atualizando dados do servidor...</p>
               </div>
            )}

            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                  <span className="font-medium">{result.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${result.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {result.message}
                    </span>
                    {result.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
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
