"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { AgendaKanbanView } from "@/components/citas/agenda-kanban-view"
import { NuevaCitaDialog } from "@/components/citas/nueva-cita-dialog"
import { getSucursalesActivasFromDB, getSucursalByIdFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, type User } from "@/lib/auth"

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

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin')
  const userSucursalId = currentUser?.sucursalId

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    async function loadSucursales() {
      if (isAdmin) {
        const sucursalesData = await getSucursalesActivasFromDB()
        setSucursales(sucursalesData)
        if (sucursalesData.length > 0) {
          setSucursalId(sucursalesData[0].id)
        }
      } else if (userSucursalId) {
        const sucursal = await getSucursalByIdFromDB(userSucursalId)
        if (sucursal) {
          setSucursales([sucursal])
          setSucursalId(userSucursalId)
        }
      }
    }
    if (currentUser) {
      loadSucursales()
    }
  }, [currentUser, isAdmin, userSucursalId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Citas</h1>
          <p className="text-muted-foreground">Gestiona las citas y el calendario</p>
        </div>
        {sucursalId && (
          <NuevaCitaDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            selectedDate={selectedDate}
            sucursalId={sucursalId}
          />
        )}
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cita
        </Button>
      </div>

      <AgendaKanbanView selectedDate={selectedDate} onDateChange={setSelectedDate} />
    </div>
  )
}
