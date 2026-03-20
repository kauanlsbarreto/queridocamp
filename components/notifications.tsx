'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Zap, ExternalLink, X, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/hooks/use-toast'

type Notificacao = {
  id: number
  titulo: string
  descricao: string
  data: string
  pagina: string | null
}

function formatDate(raw: string) {
  const d = new Date(raw)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function Notifications() {
  const { toast } = useToast()
  const [items, setItems] = useState<Notificacao[]>([])
  const [readIds, setReadIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [userAdminLevel, setUserAdminLevel] = useState(0)
  const [requesterGuid, setRequesterGuid] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ titulo: '', descricao: '', pagina: '' })

  const syncNotifications = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading) {
      setLoading(true)
    }

    try {
      const res = await fetch('/api/notificacoes', { cache: 'no-store' })
      if (!res.ok) {
        return
      }

      const data: Notificacao[] = await res.json()
      setItems((prev) => {
        const prevIds = new Set(prev.map((item) => item.id))
        const hasNewUnread = data.some((item) => !prevIds.has(item.id) && !readIds.includes(item.id))

        if (hasNewUnread) {
          setShowBanner(true)
        }

        return data
      })
      setFetched(true)
    } catch (error) {
      console.error('Erro ao buscar notificacoes:', error)
    } finally {
      if (options?.showLoading) {
        setLoading(false)
      }
    }
  }, [readIds])

  useEffect(() => {
    const stored = localStorage.getItem('qc_read_notifications_v2')
    let savedIds: number[] = []
    if (stored) {
      try { savedIds = JSON.parse(stored) } catch {}
    }
    setReadIds(savedIds)

    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUserAdminLevel(Number(parsed?.admin || parsed?.Admin || 0))
        setRequesterGuid(String(parsed?.faceit_guid || ''))
      } catch (error) {
        console.error('Erro ao ler usuario logado:', error)
      }
    }

    const handleAuthUpdate = () => {
      const nextStoredUser = localStorage.getItem('faceit_user')
      if (!nextStoredUser) {
        setUserAdminLevel(0)
        setRequesterGuid('')
        return
      }

      try {
        const parsed = JSON.parse(nextStoredUser)
        setUserAdminLevel(Number(parsed?.admin || parsed?.Admin || 0))
        setRequesterGuid(String(parsed?.faceit_guid || ''))
      } catch (error) {
        console.error('Erro ao atualizar usuario logado:', error)
      }
    }

    window.addEventListener('faceit_auth_updated', handleAuthUpdate)

    fetch('/api/notificacoes', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Notificacao[]) => {
        setItems(data)
        setFetched(true)
        const hasUnread = data.some((n) => !savedIds.includes(n.id))
        if (hasUnread) {
          setTimeout(() => setShowBanner(true), 800)
        }
      })
      .catch(() => setFetched(true))

    return () => {
      window.removeEventListener('faceit_auth_updated', handleAuthUpdate)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      syncNotifications()
    }, 30000)

    return () => clearInterval(interval)
  }, [syncNotifications])

  const unreadCount = items.filter((u) => !readIds.includes(u.id)).length
  const hasUnread = unreadCount > 0

  const markAllRead = () => {
    const ids = items.map((u) => u.id)
    setReadIds(ids)
    localStorage.setItem('qc_read_notifications_v2', JSON.stringify(ids))
  }

  const fetchNotifications = async () => {
    if (fetched) return
    await syncNotifications({ showLoading: true })
  }

  const handleCreateNotification = async () => {
    if (!form.titulo.trim() || !form.descricao.trim()) {
      toast({
        title: 'Nova notificacao',
        description: 'Preencha titulo e descricao para continuar.',
      })
      return
    }

    if (!requesterGuid) {
      toast({
        title: 'Nova notificacao',
        description: 'Nao foi possivel validar seu usuario logado.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: form.titulo,
          descricao: form.descricao,
          pagina: form.pagina,
          requesterGuid,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao criar notificacao.')
      }

      setItems((prev) => [data as Notificacao, ...prev])
      setForm({ titulo: '', descricao: '', pagina: '' })
      setIsCreateOpen(false)
      setShowBanner(true)
      toast({
        title: 'Nova notificacao',
        description: 'Notificacao adicionada com sucesso.',
      })
    } catch (error) {
      toast({
        title: 'Nova notificacao',
        description: error instanceof Error ? error.message : 'Erro ao adicionar notificacao.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Banner de notificações não lidas */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-5 z-[130] flex items-center gap-3 bg-[#0d1a2a] border border-gold/30 shadow-[0_4px_30px_rgba(212,175,55,0.2)] rounded-2xl px-4 py-3 w-[92vw] max-w-md"
          >
            <div className="shrink-0 w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
              <Bell className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                {unreadCount} {unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Clique no sino para ver as atualizações.</p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="shrink-0 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Popover onOpenChange={(open) => {
        if (open) {
          fetchNotifications()
          if (hasUnread) {
            markAllRead()
            setShowBanner(false)
          }
        }
      }}>
        <PopoverTrigger asChild>
          <button className="relative glass-gold p-2 rounded-xl text-gold focus:outline-none">
            <Bell className="h-6 w-6" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] font-bold text-white items-center justify-center border border-gray-900">
                  {unreadCount}
                </span>
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[340px] p-0 overflow-hidden rounded-2xl border border-gold/20 bg-[#0a1220]/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] text-white">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-gold/10 to-transparent">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gold" />
              <span className="font-black text-sm uppercase tracking-widest text-gold">Atualizações</span>
            </div>

            {userAdminLevel >= 1 && userAdminLevel <= 5 && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-8 rounded-full bg-gold text-black hover:bg-gold/90"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            )}
          </div>

          {/* List */}
          <div className="flex flex-col max-h-[420px] overflow-y-auto divide-y divide-white/5">
            {loading && (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <span className="w-4 h-4 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                Carregando...
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="text-center text-gray-500 py-10 text-sm">
                Nenhuma atualização no momento.
              </div>
            )}

            {!loading && items.map((item) => {
              const isUnread = !readIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  className={`flex gap-3 px-4 py-4 transition-colors hover:bg-white/5 ${isUnread ? 'bg-gold/5' : ''}`}
                >
                  <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${isUnread ? 'bg-gold/20 border-gold/40' : 'bg-white/5 border-white/10'}`}>
                    <Zap className={`w-4 h-4 ${isUnread ? 'text-gold' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-bold leading-tight ${isUnread ? 'text-white' : 'text-gray-300'}`}>
                        {item.titulo}
                      </p>
                      {isUnread && (
                        <span className="shrink-0 mt-1 w-2 h-2 rounded-full bg-gold" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-snug">{item.descricao}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-500">{formatDate(item.data)}</span>
                      {item.pagina && (
                        <Link
                          href={item.pagina}
                          className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {item.pagina}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="border-gold/20 bg-[#0a1220] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gold">Adicionar notificacao</DialogTitle>
            <DialogDescription className="text-gray-400">
              Crie uma notificacao e, se quiser, informe uma pagina para direcionar o usuario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Titulo</label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Atualizacao da classificacao"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Descricao</label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o que mudou"
                className="min-h-[120px] border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Pagina</label>
              <Input
                value={form.pagina}
                onChange={(e) => setForm((prev) => ({ ...prev, pagina: e.target.value }))}
                placeholder="Ex: /classificacao"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="border-white/10 bg-transparent text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateNotification}
              disabled={isSubmitting}
              className="bg-gold text-black hover:bg-gold/90"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar notificacao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}