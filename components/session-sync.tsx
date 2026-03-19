"use client";

import { useEffect, useRef } from "react";

const SESSION_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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
        if (!user.id) return;

      const res = await fetch(`/api/admin/players?id=${user.id}`, { cache: 'no-store' });
      if (res.ok) {
        const updatedData = await res.json();

        let newUser: any = {
          ...user,
          ...updatedData,
          Admin: updatedData.admin,
          nickname: updatedData.nickname,
          faceit_guid: updatedData.faceit_guid,
          avatar: updatedData.avatar || user.avatar,
        };

        if (user.accessToken && user.faceit_guid) {
          try {
            const faceitRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
              headers: { Authorization: `Bearer ${user.accessToken}` },
            });
            if (faceitRes.ok) {
              const faceitData = await faceitRes.json();
              if (faceitData.picture && faceitData.picture !== newUser.avatar) {
                newUser.avatar = faceitData.picture;
                await fetch('/api/players', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    guid: user.faceit_guid,
                    nickname: user.nickname,
                    avatar: faceitData.picture,
                  }),
                });
              }
            }
          } catch (e) {
            console.error('Failed to refresh Faceit profile:', e);
          }
        }

        if ('admin' in newUser) delete newUser.admin;

        if (JSON.stringify(user) !== JSON.stringify(newUser)) {
          localStorage.setItem('faceit_user', JSON.stringify(newUser));
          window.dispatchEvent(new Event('storage'));
        }
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

    const interval = setInterval(syncSession, SESSION_SYNC_INTERVAL_MS);

    syncSession();

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null; 
}
