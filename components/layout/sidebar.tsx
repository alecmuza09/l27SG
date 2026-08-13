"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Calendar,
  Users,
  UserCircle,
  Briefcase,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  Building2,
  LogOut,
  Gift,
  Tag,
  Palmtree,
  ChevronLeft,
  ChevronRight,
  Receipt,
  UserX,
  FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  logout,
  getCurrentUser,
  isSanJeronimoRestrictedNavUser,
  usuarioPuedeVerStockSucursal,
} from "@/lib/auth"
import { useRouter } from "next/navigation"
import { canAccessVacacionesModule, userIsSucursalScopedLike } from "@/lib/auth-vacaciones"

// Catálogo y sedes globales: sólo admin / superadmin en el sidebar
const GLOBAL_ADMIN_ONLY = new Set([
  "/dashboard/servicios",
  "/dashboard/inventario",
  "/dashboard/sucursales",
  "/dashboard/promociones",
])

const SAN_JERONIMO_NAV_HREFS = new Set([
  "/dashboard/citas",
  "/dashboard/clientes",
  "/dashboard/pagos",
  "/dashboard/reportes",
])
const SAN_JERONIMO_MODULE_HREFS = new Set([
  "/dashboard/gift-cards",
  "/dashboard/vacaciones",
  "/dashboard/ausencias",
])

// ─── sidebar: branch-admin ───────────────────────────────────────────────
// Ocultamos el dashboard raíz para cuentas de sucursal; reportes sólo ocultos para manager.

const navigation = [
  { name: "Dashboard",  href: "/dashboard",           icon: BarChart3  },
  { name: "Citas",      href: "/dashboard/citas",      icon: Calendar   },
  { name: "Clientes",   href: "/dashboard/clientes",   icon: Users      },
  { name: "Empleados",  href: "/dashboard/empleados",  icon: UserCircle },
  { name: "Servicios",  href: "/dashboard/servicios",  icon: Briefcase  },
  { name: "Inventario", href: "/dashboard/inventario", icon: Package    },
  { name: "Pagos",      href: "/dashboard/pagos",      icon: CreditCard },
  { name: "Reportes",   href: "/dashboard/reportes",   icon: BarChart3  },
  { name: "Sucursales", href: "/dashboard/sucursales", icon: Building2  },
]

const newModules = [
  { name: "Gift Cards",  href: "/dashboard/gift-cards",  icon: Gift    },
  { name: "Promociones", href: "/dashboard/promociones", icon: Tag     },
  { name: "Vacaciones",  href: "/dashboard/vacaciones",  icon: Palmtree},
  { name: "Ausencias",   href: "/dashboard/ausencias",   icon: UserX   },
]

const settingsNav = [{ name: "Configuración", href: "/dashboard/configuracion", icon: Settings }]

// Rutas exclusivas para superadmin
const superAdminNav = [
  { name: "Nóminas", href: "/dashboard/nominas", icon: FileSpreadsheet },
]

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const currentUser = getCurrentUser()
  const isGlobalAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin"
  const isSuperAdmin = currentUser?.role === "superadmin"
  /** Cuentas con alcance de sucursala (bloquear «Dashboard» global) */
  const isSucursalScoped = userIsSucursalScopedLike(currentUser)
  const sanJerRestrictedMenu =
    !isGlobalAdmin && isSanJeronimoRestrictedNavUser(currentUser)

  // Inventario > Stock por sucursal: visible para cualquier usuario con sucursal asignada (ver lib/auth.ts)
  const mostrarStockSucursal = usuarioPuedeVerStockSucursal(currentUser)
  const stockSucursalNavItem = { name: "Stock Sucursal", href: "/dashboard/inventario/sucursal", icon: Package }

  const visibleNav = isGlobalAdmin
    ? navigation
    : sanJerRestrictedMenu
      ? [
          ...navigation.filter((i) => SAN_JERONIMO_NAV_HREFS.has(i.href)),
          ...(mostrarStockSucursal ? [stockSucursalNavItem] : []),
        ]
      : navigation.filter((i) => {
          if (GLOBAL_ADMIN_ONLY.has(i.href)) return false
          if (i.href === "/dashboard/empleados" && currentUser?.role !== "branch-admin") return false
          if (i.href === "/dashboard" && isSucursalScoped) return false
          // Reportes oculto para managers (no tienen acceso); branch-admin y superiores sí lo ven
          if (i.href === "/dashboard/reportes" && currentUser?.role === "manager") return false
          return true
        }).concat(mostrarStockSucursal ? [stockSucursalNavItem] : [])
  const visibleModules = isGlobalAdmin
    ? newModules
    : sanJerRestrictedMenu
      ? newModules.filter((i) => {
          if (!SAN_JERONIMO_MODULE_HREFS.has(i.href)) return false
          if (i.href === "/dashboard/vacaciones" && !canAccessVacacionesModule(currentUser)) return false
          return true
        })
      : newModules.filter((i) => {
          if (GLOBAL_ADMIN_ONLY.has(i.href)) return false
          if (i.href === "/dashboard/vacaciones" && !canAccessVacacionesModule(currentUser)) return false
          return true
        })

  const handleLogout = async () => {
    await logout()
    router.push("/")
    router.refresh()
  }

  return (
    <div className={cn(
      "flex h-full flex-col bg-card border-r border-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!isCollapsed && <h1 className="text-xl font-bold text-primary">Luna27</h1>}
        {isCollapsed && <h1 className="text-xl font-bold text-primary">L27</h1>}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden lg:flex"
          onClick={onToggle}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-2",
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}

        <div className="my-4 border-t border-border" />
        {!isCollapsed && (
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Gestión Adicional
          </p>
        )}
        {visibleModules.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}

        {isSuperAdmin && (
          <>
            <div className="my-4 border-t border-border" />
            {!isCollapsed && (
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Finanzas
              </p>
            )}
            {superAdminNav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && "justify-center"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </>
        )}

        {settingsNav.length > 0 && !sanJerRestrictedMenu && (
          <>
            <div className="my-4 border-t border-border" />
            {settingsNav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && "justify-center"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      <div className="border-t border-border p-4">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full transition-colors",
            isCollapsed ? "justify-center px-2" : "justify-start"
          )} 
          onClick={handleLogout}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <LogOut className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")} />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </Button>
      </div>

    </div>
  )
}
