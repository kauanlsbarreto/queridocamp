"use client"

import { useEffect } from "react"

const LOCALHOST_SKIP_AUTOLOGIN_KEY = "localhost_skip_auto_login_once"

export default function LocalhostWatcher() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hostname !== "localhost") return

    const initLocalhostUser = async () => {
      // Evita relogin automatico imediato apos logout manual em localhost.
      if (sessionStorage.getItem(LOCALHOST_SKIP_AUTOLOGIN_KEY) === "1") {
        sessionStorage.removeItem(LOCALHOST_SKIP_AUTOLOGIN_KEY)
        return
      }

      const stored = localStorage.getItem("faceit_user")
      if (!stored) {
        try {
          // Tenta buscar o usuário pelo nickname no banco de dados
          const res = await fetch("/api/admin/players?nickname=Sh4yKon")
          let userData

          if (res.ok) {
            userData = await res.json()
            // Garante que o campo Admin (maiúsculo) esteja presente para compatibilidade
            if (userData.admin !== undefined) {
                userData.Admin = userData.admin
            }
          } else {
            console.warn("Usuário Sh4yKon não encontrado no banco. Usando mock estático.")
            userData = {
              id: 1,
              faceit_guid: "fcb1b15c-f3d4-47d1-bd27-b478b7ada9ee",
              nickname: "Sh4yKon",
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