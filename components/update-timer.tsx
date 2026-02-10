"use client"

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';

interface UpdateTimerProps {
  lastUpdate: string;
}

export default function UpdateTimer({ lastUpdate }: UpdateTimerProps) {
  const [formattedDate, setFormattedDate] = useState<string>("");

  useEffect(() => {
    setFormattedDate(format(new Date(lastUpdate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }));
  }, [lastUpdate]);

  if (!formattedDate) {
    return (
      <p className="text-center text-gray-400 mb-6 text-sm">
        Última atualização: <span className="text-gold font-bold">...</span>
      </p>
    )
  }

  return (
    <p className="text-center text-gray-400 mb-6 text-sm">
      Última atualização: <span className="text-gold font-bold">{formattedDate}</span>
    </p>
  )
}