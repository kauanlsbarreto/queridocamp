'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1481322006463905988/P2MJlcw-dvxcAE4-FIwKlE6f6GdPhM-9E4j5pbWctQ0609judBG3dhcxC5fV3urbfioW';

interface AnalyticsData {
  page: string;
  user: string;
  ip: string;
  loadTime: string;
  dataSource: string;
  adSeen: string;
}

async function getIpAddress(): Promise<string> {
  try {
    const response = await fetch('/api/ip', { cache: 'no-store' });
    if (!response.ok) return 'Erro ao buscar IP';
    const data = await response.json();
    return data.ip || 'IP não encontrado';
  } catch (error) {
    console.error('Falha ao buscar IP:', error);
    return 'Falha na requisição de IP';
  }
}


function getLoadTime(): string {
  if (typeof window !== 'undefined' && window.performance?.getEntriesByType) {
    const navEntries = window.performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const navEntry = navEntries[0] as PerformanceNavigationTiming;
      const loadTime = navEntry.domContentLoadedEventEnd;
      if (loadTime > 0) {
        return `${(loadTime / 1000).toFixed(2)}s`;
      }
    }
  }
  return 'N/A';
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const sendAnalytics = async () => {
      if (window.location.hostname === 'localhost') {
        return;
      }

      const userRaw = localStorage.getItem('faceit_user');
      const user = userRaw ? JSON.parse(userRaw)?.nickname || 'Anônimo' : 'Anônimo';
      
      const ip = await getIpAddress();
      const loadTime = getLoadTime();
      
      const dataSource = 'Cache';

      const adSeen = (window as any).adWasShown ? 'Sim' : 'Não';

      const data: AnalyticsData = { page: pathname, user, ip, loadTime, dataSource, adSeen };

      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: 'Acesso no Site',
              color: 0xDAA520, 
              fields: [
                { name: 'Página Acessada', value: `\`${data.page}\``, inline: true },
                { name: 'Usuário', value: data.user, inline: true },
                { name: 'IP', value: data.ip, inline: true },
                { name: 'Tempo', value: data.loadTime, inline: true },
                { name: 'Fonte de Dados', value: data.dataSource, inline: true },
                { name: 'AD', value: data.adSeen, inline: true },
              ],
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch (error) {
        console.error('Erro ao enviar analytics para o Discord:', error);
      }
    };

    const timer = setTimeout(sendAnalytics, 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}