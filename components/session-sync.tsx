"use client";

import { useEffect } from "react";

export default function SessionSync() {
  useEffect(() => {
    const syncSession = async () => {
      const storedUser = localStorage.getItem("faceit_user");
      if (!storedUser) return;

      try {
        const user = JSON.parse(storedUser);
        if (!user.id) return;

        // sync with DB record first (admin route just returns stored info)
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

        // also try to pull freshest profile from Faceit if we have a token
        if (user.accessToken && user.faceit_guid) {
          try {
            const faceitRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
              headers: { Authorization: `Bearer ${user.accessToken}` },
            });
            if (faceitRes.ok) {
              const faceitData = await faceitRes.json();
              if (faceitData.picture && faceitData.picture !== newUser.avatar) {
                newUser.avatar = faceitData.picture;
                // update DB so other clients see the change
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
          console.log('Sessão atualizada em background:', newUser);
          localStorage.setItem('faceit_user', JSON.stringify(newUser));
          window.dispatchEvent(new Event('storage'));
        }
      }
      } catch (error) {
      }
    };

    const interval = setInterval(syncSession, 1000);
    
    syncSession();

    return () => clearInterval(interval);
  }, []);

  return null; 
}
