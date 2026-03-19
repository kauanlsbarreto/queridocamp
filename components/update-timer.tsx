"use client"

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UpdateTimerProps {
  lastUpdate: string;
}

export default function UpdateTimer({ lastUpdate }: UpdateTimerProps) {
  const [remainingMinutes, setRemainingMinutes] = useState<number>(30);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [nextUpdateLabel, setNextUpdateLabel] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const lastRefreshSlotRef = useRef<string>('');
  const router = useRouter();

  const getNextScheduledUpdate = (now: Date) => {
    const next = new Date(now);
    next.setSeconds(0, 0);

    const minute = now.getMinutes();
    if (minute < 1) {
      next.setMinutes(1);
      return next;
    }
    if (minute < 31) {
      next.setMinutes(31);
      return next;
    }

    next.setHours(next.getHours() + 1);
    next.setMinutes(1);
    return next;
  };

  const updateCountdown = () => {
    const now = new Date();
    const nextUpdate = getNextScheduledUpdate(now);
    const diffMs = nextUpdate.getTime() - now.getTime();
    const totalSeconds = Math.max(0, Math.ceil(diffMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    setRemainingMinutes(minutes);
    setRemainingSeconds(seconds);
    setNextUpdateLabel(format(nextUpdate, "HH:mm", { locale: ptBR }));

    if (totalSeconds > 2 && isRefreshing) {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    updateCountdown();

    const interval = setInterval(() => {
      const now = new Date();
      const minute = now.getMinutes();
      const second = now.getSeconds();

      // Refresh once at each scheduled tick: xx:01 and xx:31
      if ((minute === 1 || minute === 31) && second < 2) {
        const slotKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${minute}`;
        if (lastRefreshSlotRef.current !== slotKey) {
          lastRefreshSlotRef.current = slotKey;
          setIsRefreshing(true);
          router.refresh();
        }
      }

      updateCountdown();
    }, 1000);

    return () => clearInterval(interval);
  }, [router, lastUpdate]);

  return (
    <p className="text-center text-gray-400 mb-6 text-sm">
      {isRefreshing ? (
        <>Atualizando a página...</>
      ) : (
        <>
          Próxima atualização em <span className="text-gold font-bold">{remainingMinutes} minuto{remainingMinutes === 1 ? '' : 's'} e {remainingSeconds} segundo{remainingSeconds === 1 ? '' : 's'}</span> ({nextUpdateLabel})
          {' '}<span className="text-gold/80">A página será atualizada automaticamente.</span>
        </>
      )}
    </p>
  )
}