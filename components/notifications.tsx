'use client'

import { useState } from 'react'
import { Bell, Zap } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

const updates = [
  {
    title: 'Botão de Pesquisa',
    date: '30/01/2026',
    description: 'Adicionamos um novo botão de pesquisa para facilitar a navegação em rodadas e classificação',
  },
  {
    title: 'Atualização de Classificação',
    date: '30/01/2026',
    description: 'Adicionamos o detalhamento da classificação com as partidas de cada time',
  },
    {
    title: 'Botão de Notificações',
    date: '30/01/2026',
    description: 'Adicionamos um novo botão de notificações para facilitar o acesso às atualizações.',
  },
  {
    title: 'Botão de Login',
    date: '29/01/2026',
    description: 'Adicionamos um novo botão de login para facilitar o acesso dos usuários.',
  },
  {
    title: 'Página de Redondo',
    date: '29/01/2026',
    description: 'Adicionamos uma nova página de redondo.',
  }
]

export function Notifications() {
  const [hasUnread, setHasUnread] = useState(true) 
  const unreadCount = updates.length

  return (
    <Popover onOpenChange={() => setHasUnread(false)}>
      <PopoverTrigger asChild>
        <button
          className="relative glass-gold p-2 rounded-xl text-gold focus:outline-none"
        >
          <Bell className="h-6 w-6" />
          {hasUnread && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] font-bold text-white items-center justify-center border border-gray-900">
                {unreadCount}
              </span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-gray-900/80 backdrop-blur-md border-gold/20 text-white">
        <div className="p-4">
          <h4 className="font-bold text-lg text-gold mb-2">Atualizações Recentes</h4>
          <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
            {updates.map((update, index) => (
              <div key={index}>
                <div className="flex items-start gap-3">
                  <div className="bg-gold/10 p-2 rounded-full mt-1">
                    <Zap className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-bold">{update.title}</p>
                    <p className="text-sm text-white/70">{update.description}</p>
                    <p className="text-xs text-white/50 mt-1">{update.date}</p>
                  </div>
                </div>
                {index < updates.length - 1 && <Separator className="my-3 bg-gold/10" />}
              </div>
            ))}
             {updates.length === 0 && (
                <div className="text-center text-white/70 py-4">
                    Nenhuma atualização no momento.
                </div>
             )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}