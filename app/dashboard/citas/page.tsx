"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { AgendaKanbanView } from "@/components/citas/agenda-kanban-view"
import { NuevaCitaDialog } from "@/components/citas/nueva-cita-dialog"
import { getSucursalesActivasFromDB, getSucursalesByIdsFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, type User } from "@/lib/auth"
import { cn } from "@/lib/utils"

export default function CitasPage() {
  // Obtener fecha actual en zona horaria local
  const getTodayLocal = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedDate, setSelectedDate] = useState(getTodayLocal())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState<string>("")
  const [refreshCitasKey, setRefreshCitasKey] = useState(0)

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin')
  const userSucursalIds = currentUser?.sucursalIds ?? (currentUser?.sucursalId ? [currentUser.sucursalId] : [])

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    async function loadSucursales() {
      if (isAdmin) {
        const sucursalesData = await getSucursalesActivasFromDB()
        setSucursales(sucursalesData)
        // Default: sucursal propia si existe, sino la primera de la lista
        const primaryId = currentUser?.sucursalId
        const defaultId = sucursalesData.find(s => s.id === primaryId)?.id ?? sucursalesData[0]?.id
        if (defaultId) setSucursalId(defaultId)
      } else if (userSucursalIds.length > 0) {
        const sucursalesData = await getSucursalesByIdsFromDB(userSucursalIds)
        if (sucursalesData.length > 0) {
          setSucursales(sucursalesData)
          // Default: siempre la sucursal principal del usuario
          const primaryId = currentUser?.sucursalId
          const defaultId = sucursalesData.find(s => s.id === primaryId)?.id ?? sucursalesData[0].id
          setSucursalId(defaultId)
        }
      }
    }
    if (currentUser) {
      loadSucursales()
    }
  }, [currentUser, isAdmin, userSucursalIds.join(',')])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Citas</h1>
          <p className="text-muted-foreground">Gestiona las citas y el calendario</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} disabled={!sucursalId}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cita
        </Button>
      </div>

      {/* Layout: en desktop con panel abierto → split 65/35 */}
      <div className={cn("flex gap-4 items-start min-h-0", isDialogOpen && "lg:flex-row")}>
        {/* Agenda — se comprime cuando el panel está abierto */}
        <div className={cn(
          "min-w-0 transition-all duration-300",
          isDialogOpen ? "flex-1 hidden lg:block" : "w-full"
        )}>
          <AgendaKanbanView
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedSucursal={sucursalId}
            onSucursalChange={setSucursalId}
            refreshCitasKey={refreshCitasKey}
          />
        </div>

        {/* Panel lateral inline — solo en desktop lg+ */}
        {isDialogOpen && sucursalId && (
          <div className="hidden lg:flex flex-col w-[420px] xl:w-[460px] shrink-0 border rounded-xl bg-background shadow-lg overflow-hidden" style={{ maxHeight: "calc(100vh - 180px)" }}>
            <NuevaCitaDialog
              open={isDialogOpen}
              onOpenChange={(v) => {
                setIsDialogOpen(v)
                if (!v) setRefreshCitasKey((k) => k + 1)
              }}
              selectedDate={selectedDate}
              sucursalId={sucursalId}
              onCitaCreada={() => setRefreshCitasKey((k) => k + 1)}
              asPanel
            />
          </div>
        )}
      </div>

      {/* Sheet modal — solo en móvil (< lg) */}
      {sucursalId && (
        <div className="lg:hidden">
          <NuevaCitaDialog
            open={isDialogOpen}
            onOpenChange={(v) => {
              setIsDialogOpen(v)
              if (!v) setRefreshCitasKey((k) => k + 1)
            }}
            selectedDate={selectedDate}
            sucursalId={sucursalId}
            onCitaCreada={() => setRefreshCitasKey((k) => k + 1)}
          />
        </div>
      )}
    </div>
  )
}
