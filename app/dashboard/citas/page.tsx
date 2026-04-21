"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { AgendaKanbanView } from "@/components/citas/agenda-kanban-view"
import { NuevaCitaDialog } from "@/components/citas/nueva-cita-dialog"
import { getSucursalesActivasFromDB, getSucursalesByIdsFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, type User } from "@/lib/auth"

export default function CitasPage() {
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
  // Detectado en JS para nunca montar Sheet y Panel al mismo tiempo
  const [isDesktop, setIsDesktop] = useState(false)

  const isAdmin: boolean = Boolean(
    currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
  )
  const userSucursalIds = currentUser?.sucursalIds ?? (currentUser?.sucursalId ? [currentUser.sucursalId] : [])

  // Detectar breakpoint lg (≥1024px) en tiempo de ejecución
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    async function loadSucursales() {
      if (isAdmin) {
        const sucursalesData = await getSucursalesActivasFromDB()
        setSucursales(sucursalesData)
        const primaryId = currentUser?.sucursalId
        const defaultId = sucursalesData.find(s => s.id === primaryId)?.id ?? sucursalesData[0]?.id
        if (defaultId) setSucursalId(defaultId)
      } else if (userSucursalIds.length > 0) {
        const sucursalesData = await getSucursalesByIdsFromDB(userSucursalIds)
        if (sucursalesData.length > 0) {
          setSucursales(sucursalesData)
          const primaryId = currentUser?.sucursalId
          const defaultId = sucursalesData.find(s => s.id === primaryId)?.id ?? sucursalesData[0].id
          setSucursalId(defaultId)
        }
      }
    }
    if (currentUser) loadSucursales()
  }, [currentUser, isAdmin, userSucursalIds.join(',')])

  const handlePanelClose = (v: boolean) => {
    setIsDialogOpen(v)
    if (!v) setRefreshCitasKey(k => k + 1)
  }

  const panelOpen = isDialogOpen && !!sucursalId

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

      {/*
        ──────────────────────────────────────────────────────────────
        LAYOUT SPLIT — Agenda + Panel como hermanos en flex.
        En desktop (isDesktop=true): agenda se encoge, panel aparece al lado.
        En móvil: sólo la agenda; el Sheet se monta por separado abajo.
        NUNCA se renderizan Panel y Sheet al mismo tiempo.
        ──────────────────────────────────────────────────────────────
      */}
      <div className="flex items-start w-full overflow-hidden">

        {/* Agenda — se encoge cuando el panel lateral está visible */}
        <div
          style={{
            width: panelOpen && isDesktop ? '68%' : '100%',
            transition: 'width 300ms ease',
            minWidth: 0,
          }}
        >
          <AgendaKanbanView
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedSucursal={sucursalId}
            onSucursalChange={setSucursalId}
            refreshCitasKey={refreshCitasKey}
          />
        </div>

        {/* Panel lateral — hermano del agenda, SIN overlay, SIN portal.
            Solo se monta en desktop cuando el panel está abierto. */}
        {panelOpen && isDesktop && (
          <div
            className="shrink-0 border-l bg-background flex flex-col overflow-hidden shadow-lg"
            style={{
              width: '32%',
              height: 'calc(100vh - 160px)',
              position: 'sticky',
              top: 0,
            }}
          >
            <NuevaCitaDialog
              open
              onOpenChange={handlePanelClose}
              selectedDate={selectedDate}
              sucursalId={sucursalId}
              onCitaCreada={() => setRefreshCitasKey(k => k + 1)}
              asPanel
            />
          </div>
        )}
      </div>

      {/* Sheet para móvil — solo se monta cuando NO es desktop.
          Esto evita que el portal del Sheet aparezca en pantallas grandes. */}
      {panelOpen && !isDesktop && (
        <NuevaCitaDialog
          open
          onOpenChange={handlePanelClose}
          selectedDate={selectedDate}
          sucursalId={sucursalId}
          onCitaCreada={() => setRefreshCitasKey(k => k + 1)}
        />
      )}
    </div>
  )
}
