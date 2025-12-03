"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Trophy, Users, Calendar, BarChart, Settings, LogOut, Menu, X, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Verificar autenticação
    const checkAuth = () => {
      const token = localStorage.getItem("adminToken")

      // Se estamos na página de login, não precisamos redirecionar
      if (pathname === "/admin/login") {
        setIsAuthenticated(!!token)
        setIsLoading(false)
        return
      }

      // Se não temos token e não estamos na página de login, redirecionar
      if (!token) {
        router.push("/admin/login")
        return
      }

      setIsAuthenticated(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [pathname, router])

  const handleLogout = () => {
    localStorage.removeItem("adminToken")
    setIsAuthenticated(false)
    router.push("/admin/login")
  }

  // Se estamos na página de login, apenas renderizar o conteúdo
  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  // Mostrar tela de carregamento enquanto verificamos autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    )
  }

  // Se não estiver autenticado, não mostrar nada (o useEffect vai redirecionar)
  if (!isAuthenticated) {
    return null
  }

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: <BarChart size={20} /> },
    { href: "/admin/teams", label: "Times", icon: <Trophy size={20} /> },
    { href: "/admin/players", label: "Jogadores", icon: <Users size={20} /> },
    { href: "/admin/matches", label: "Partidas", icon: <Calendar size={20} /> },
    { href: "/admin/settings", label: "Configurações", icon: <Settings size={20} /> },
  ]

  return (
    <div className="min-h-screen bg-black flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center">
          <Trophy className="text-gold mr-2" size={24} />
          <span className="text-gold font-bold">Admin</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-white hover:bg-gray-800"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      {/* Sidebar - Mobile (Overlay) */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)}>
          <div
            className="w-64 h-full bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-8">
              <Trophy className="text-gold mr-2" size={24} />
              <span className="text-gold font-bold">Querido Camp Admin</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                    pathname === item.href ? "bg-gold/10 text-gold" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <Link
                href="/"
                className="flex items-center px-4 py-3 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                target="_blank"
              >
                <Home size={20} className="mr-3" />
                Ver Site
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 rounded-md text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
              >
                <LogOut size={20} className="mr-3" />
                Sair
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar - Desktop (Fixed) */}
      <div className="hidden md:block w-64 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto">
        <div className="flex items-center mb-8">
          <Trophy className="text-gold mr-2" size={24} />
          <span className="text-gold font-bold">Querido Camp Admin</span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                pathname === item.href ? "bg-gold/10 text-gold" : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            className="flex items-center px-4 py-3 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            target="_blank"
          >
            <Home size={20} className="mr-3" />
            Ver Site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 rounded-md text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            Sair
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
