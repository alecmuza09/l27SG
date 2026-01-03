"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, CalendarIcon, List, LayoutGrid } from "lucide-react"
import { CalendarView } from "@/components/citas/calendar-view"
import { DaySchedule } from "@/components/citas/day-schedule"
import { AgendaKanbanView } from "@/components/citas/agenda-kanban-view"
import { NuevaCitaDialog } from "@/components/citas/nueva-cita-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"

export default function CitasPage() {
  // Obtener fecha actual en zona horaria local
  const getTodayLocal = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const [selectedDate, setSelectedDate] = useState(getTodayLocal())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState<string>("")

  useEffect(() => {
    async function loadSucursales() {
      const sucursalesData = await getSucursalesActivasFromDB()
      setSucursales(sucursalesData)
      if (sucursalesData.length > 0) {
        setSucursalId(sucursalesData[0].id)
      }
    }
    loadSucursales()
  }, [])

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

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agenda" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Vista Agenda Avanzada
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Vista Calendario
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <List className="h-4 w-4" />
            Vista Agenda Simple
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          <AgendaKanbanView selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <CalendarView selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </div>
            <div className="lg:col-span-2">
              <DaySchedule date={selectedDate} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <DaySchedule date={selectedDate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
