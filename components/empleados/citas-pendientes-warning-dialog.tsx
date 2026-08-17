"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CitaPendienteResumen } from "@/lib/data/citas-pendientes"

function formatearFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface CitasPendientesWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleadoNombre: string
  /** Verbo/frase de la acción, ej. "desactivarla", "eliminarla", "vencer su contrato" */
  accion: string
  citas: CitaPendienteResumen[]
  onContinuar: () => void
  /** Se llama al continuar; si no se provee, no se ejecuta onContinuar en cierre por overlay/esc */
  isProcessing?: boolean
}

export function CitasPendientesWarningDialog({
  open,
  onOpenChange,
  empleadoNombre,
  accion,
  citas,
  onContinuar,
  isProcessing = false,
}: CitasPendientesWarningDialogProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>⚠️ Citas pendientes sin atender</DialogTitle>
          <DialogDescription>
            {empleadoNombre} tiene {citas.length} {citas.length === 1 ? "cita pendiente" : "citas pendientes"}. Al{" "}
            {accion}, {citas.length === 1 ? "esa cita" : "esas citas"} quedará{citas.length === 1 ? "" : "n"} sin
            atender.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {citas.map((cita) => (
                <TableRow key={cita.id}>
                  <TableCell className="whitespace-nowrap">{formatearFechaCorta(cita.fecha)}</TableCell>
                  <TableCell className="whitespace-nowrap">{cita.horaInicio}</TableCell>
                  <TableCell>{cita.clienteNombre}</TableCell>
                  <TableCell>{cita.servicioNombre}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/dashboard/citas")}
            disabled={isProcessing}
          >
            Ver en agenda
          </Button>
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onContinuar}
            disabled={isProcessing}
          >
            Continuar de todas formas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
