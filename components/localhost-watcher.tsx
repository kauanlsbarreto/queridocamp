"use client"

import { useEffect } from "react"

export default function LocalhostWatcher() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hostname !== "localhost") return

    const initLocalhostUser = async () => {
      const stored = localStorage.getItem("faceit_user")
      if (!stored) {
        try {
          // Tenta buscar o usuário pelo nickname no banco de dados
          const res = await fetch("/api/admin/players?nickname=-ShaykonBio-")
          let userData

          if (res.ok) {
            userData = await res.json()
            // Garante que o campo Admin (maiúsculo) esteja presente para compatibilidade
            if (userData.admin !== undefined) {
                userData.Admin = userData.admin
            }
          } else {
            console.warn("Usuário -ShaykonBio- não encontrado no banco. Usando mock estático.")
            userData = {
              id: 999999,
              faceit_guid: "local-dev-guid",
              nickname: "-ShaykonBio-",
              avatar: "https://distribution.faceit-cdn.net/images/183bacac-0e2c-4ade-867c-cb5df6e55058.jpg",
              Admin: 1,
            }
          }

          localStorage.setItem("faceit_user", JSON.stringify(userData))
          
          // Notifica componentes e recarrega para aplicar o login
          window.dispatchEvent(new Event("faceit_auth_updated"))
          window.location.reload()
        } catch (error) {
          console.error("Erro ao configurar usuário localhost:", error)
        }
      }
    }

    initLocalhostUser()
  }, [])

  return null
}