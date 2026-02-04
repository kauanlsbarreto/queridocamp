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

        const res = await fetch(`/api/admin/players?id=${user.id}`, { cache: 'no-store' });
        if (res.ok) {
          const updatedData = await res.json();
          
          const newUser = {
            ...user,
            ...updatedData,
            Admin: updatedData.admin, 
            nickname: updatedData.nickname,
            faceit_guid: updatedData.faceit_guid,
            avatar: updatedData.avatar || user.avatar
          };

          if ('admin' in newUser) delete newUser.admin;

          if (JSON.stringify(user) !== JSON.stringify(newUser)) {
             console.log("Sessão atualizada em background:", newUser);
             localStorage.setItem("faceit_user", JSON.stringify(newUser));
             
             window.dispatchEvent(new Event("storage"));
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
