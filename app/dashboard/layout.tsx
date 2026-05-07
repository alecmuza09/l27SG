"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Menu, X, Loader2 } from "lucide-react"
import { refreshSession } from "@/lib/auth"
import { canAccessVacacionesModule, userIsSucursalScopedLike } from "@/lib/auth-vacaciones"

// Rutas que solo puede visitar un admin
const ADMIN_ONLY_ROUTES = [
  "/dashboard/empleados",
  "/dashboard/servicios",
  "/dashboard/inventario",
  "/dashboard/sucursales",
  "/dashboard/promociones",
]

// Rutas bloqueadas para managers y branch-admin (cuentas de sucursal)
const SUCURSAL_SCOPED_BLOCKED_ROUTES = ["/dashboard/reportes"]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [authChecked, setAuthChecked]   = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function checkAuth() {
      const user = await refreshSession()
      if (!user) {
        router.replace("/")
        return
      }
      // Redirigir manager/staff si intentan acceder a rutas exclusivas de admin
      if (user.role !== "admin") {
        const isAdminRoute = ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))
        if (isAdminRoute) {
          router.replace("/dashboard/citas")
          return
        }
      }
      if (pathname.startsWith("/dashboard/vacaciones") && !canAccessVacacionesModule(user)) {
        router.replace("/dashboard/citas")
        return
      }
      // Redirigir managers / branch-admin si intentan acceder a dashboard principal o reportes
      if (userIsSucursalScopedLike(user)) {
        const isSucursalBlocked =
          pathname === "/dashboard" || SUCURSAL_SCOPED_BLOCKED_ROUTES.some((r) => pathname.startsWith(r))
        if (isSucursalBlocked) {
          router.replace("/dashboard/citas")
          return
        }
      }
      setAuthChecked(true)
    }
    checkAuth()
  }, [router, pathname])

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarOpen ? 'w-64' : 'w-0 lg:w-16'}
        `}
      >
        <Sidebar isCollapsed={!sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </aside>
      
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </Header>
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
