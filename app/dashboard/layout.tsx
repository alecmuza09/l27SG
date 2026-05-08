"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Menu, X, Loader2 } from "lucide-react"
import { refreshSession } from "@/lib/auth"
import { canAccessVacacionesModule } from "@/lib/auth-vacaciones"

// Catálogo y configuración global: sólo admin / superadmin
const GLOBAL_ADMIN_ONLY_ROUTES = [
  "/dashboard/servicios",
  "/dashboard/inventario",
  "/dashboard/sucursales",
  "/dashboard/promociones",
]

// Empleados: admin global superadmin + branch-admin (lectura equipo de su sucursal)
const EMPLEADOS_ROUTE = "/dashboard/empleados"

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
      const isGlobalAdmin = user.role === "admin" || user.role === "superadmin"
      const isBranchAdmin = user.role === "branch-admin"

      if (!isGlobalAdmin) {
        const onGlobalStrict = GLOBAL_ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))
        if (onGlobalStrict) {
          router.replace("/dashboard/citas")
          return
        }
      }

      if (pathname.startsWith(EMPLEADOS_ROUTE)) {
        if (!isGlobalAdmin && !isBranchAdmin) {
          router.replace("/dashboard/citas")
          return
        }
      }
      if (pathname.startsWith("/dashboard/vacaciones") && !canAccessVacacionesModule(user)) {
        router.replace("/dashboard/citas")
        return
      }
      // Managers: sin dashboard ni reportes (datos sólo desde citas/u otros).
      // branch-admin sí puede usar /dashboard/reportes (alcance ya filtrado en la página).
      if (user.role === "manager") {
        if (pathname === "/dashboard" || pathname.startsWith("/dashboard/reportes")) {
          router.replace("/dashboard/citas")
          return
        }
      }
      if (user.role === "branch-admin" && pathname === "/dashboard") {
        router.replace("/dashboard/citas")
        return
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
