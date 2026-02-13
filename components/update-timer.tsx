"use client"

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UpdateTimerProps {
  lastUpdate: string;
}

export default function UpdateTimer({ lastUpdate }: UpdateTimerProps) {
  const [formattedDate, setFormattedDate] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    setFormattedDate(format(new Date(lastUpdate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }));
  }, [lastUpdate]);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/last-update', { cache: 'no-store' });
        const data = await res.json();
        // Se a data no banco for mais nova que a data atual da página, recarrega
        if (data.lastUpdate && new Date(data.lastUpdate).getTime() > new Date(lastUpdate).getTime()) {
          router.refresh();
        }
      } catch (e) {
        console.error("Erro ao verificar atualização:", e);
      }
    };

    // Verifica a cada 30 segundos
    const interval = setInterval(checkUpdate, 30000);
    return () => clearInterval(interval);
  }, [lastUpdate, router]);

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