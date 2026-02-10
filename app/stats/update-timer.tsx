"use client"

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UpdateTimerProps {
  lastUpdate: string;
}

export default function UpdateTimer({ lastUpdate }: UpdateTimerProps) {
  
  const formattedDate = format(new Date(lastUpdate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <p className="text-center text-gray-400 mb-6 text-sm">
      Última atualização: <span className="text-gold font-bold">{formattedDate}</span>
    </p>
  )
}
