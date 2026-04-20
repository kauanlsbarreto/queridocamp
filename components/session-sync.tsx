"use client";

import { useEffect, useRef } from "react";

const SESSION_SYNC_INTERVAL_MS = 10 * 1000;

export default function SessionSync() {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const syncSession = async () => {
      if (isSyncingRef.current) return;

      const storedUser = localStorage.getItem("faceit_user");
      if (!storedUser) return;

      try {
        isSyncingRef.current = true;

        const user = JSON.parse(storedUser);
        if (!user.faceit_guid) return;

        let updatedNickname = user.nickname;
        let updatedAvatar = user.avatar;
        try {
          if (user.faceit_guid) {
            const apiKey = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
            const res = await fetch(`https://open.faceit.com/data/v4/players/${user.faceit_guid}`, {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.nickname) updatedNickname = data.nickname;
              if (data.avatar) updatedAvatar = data.avatar;
            }
          }
        } catch (e) {
          console.error('Failed to refresh Faceit profile:', e);
        }

        // Atualiza localStorage e banco se mudou
        let changed = false;
        let newUser: any = { ...user };
        if (user.nickname !== updatedNickname) {
          newUser.nickname = updatedNickname;
          changed = true;
        }
        if (user.avatar !== updatedAvatar) {
          newUser.avatar = updatedAvatar;
          changed = true;
        }

        if (changed) {
          await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guid: user.faceit_guid,
              nickname: updatedNickname,
              avatar: updatedAvatar,
            }),
          });
          localStorage.setItem('faceit_user', JSON.stringify(newUser));
          window.dispatchEvent(new Event('storage'));
        }
      } catch (error) {
      } finally {
        isSyncingRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncSession();
      }
    };

    window.addEventListener('focus', syncSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Executa imediatamente ao entrar
    syncSession();
    // Executa a cada 10 segundos
    const interval = setInterval(syncSession, SESSION_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null; 
}
