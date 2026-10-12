"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, ArrowLeftRight, Loader2, Search } from "lucide-react"
import {
  type Cliente,
  type FusionClientePreview,
  previewFusionClientes,
  fusionarClientes,
  searchClientesPaginated,
} from "@/lib/data/clientes"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Clienta de la ficha actual (se conserva por defecto). */
  clienteConservar: Cliente
  onFusionCompleta: (keepId: string) => void
}

export function FusionarClienteDialog({
  open,
  onOpenChange,
  clienteConservar,
  onFusionCompleta,
}: Props) {
  const [keepId, setKeepId] = useState(clienteConservar.id)
  const [dropId, setDropId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Cliente[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [preview, setPreview] = useState<FusionClientePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [step, setStep] = useState<"buscar" | "preview" | "confirm">("buscar")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetState = useCallback(() => {
    setKeepId(clienteConservar.id)
    setDropId(null)
    setSearchQuery("")
    setSearchResults([])
    setPreview(null)
    setConfirmText("")
    setStep("buscar")
    setIsSubmitting(false)
  }, [clienteConservar.id])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }
    setKeepId(clienteConservar.id)
  }, [open, clienteConservar.id, resetState])

  const loadPreview = async (kId: string, dId: string) => {
    setPreviewLoading(true)
    setPreview(null)
    try {
      const res = await previewFusionClientes(kId, dId)
      if (!res.success || !res.preview) {
        setPreview(null)
        toast.error(res.error ?? "No se pudo cargar la vista previa")
        return res
      }
      setPreview(res.preview)
      return res
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleBuscar = async () => {
    const q = searchQuery.trim()
    if (!q) return
    setIsSearching(true)
    try {
      const { clientes } = await searchClientesPaginated(q, 1, 15)
      setSearchResults(clientes.filter(c => c.id !== keepId))
    } finally {
      setIsSearching(false)
    }
  }

  const handleElegirDrop = async (c: Cliente) => {
    setDropId(c.id)
    setSearchResults([])
    setSearchQuery("")
    const res = await loadPreview(keepId, c.id)
    if (res.success) setStep("preview")
  }

  const handleIntercambiar = async () => {
    if (!dropId) return
    const newKeep = dropId
    const newDrop = keepId
    setKeepId(newKeep)
    setDropId(newDrop)
    await loadPreview(newKeep, newDrop)
  }

  const handleContinuarConfirm = () => {
    setConfirmText("")
    setStep("confirm")
  }

  const handleFusionar = async () => {
    if (!dropId || confirmText.trim().toUpperCase() !== "FUSIONAR") return
    setIsSubmitting(true)
    try {
      const res = await fusionarClientes(keepId, dropId)
      if (!res.success) {
        toast.error(res.error ?? "No se pudo completar la fusión")
        return res
      }
      toast.success("Clientas fusionadas correctamente")
      onFusionCompleta(keepId)
      onOpenChange(false)
      return res
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fusionar con otra clienta</DialogTitle>
          <DialogDescription>
            El historial de la clienta absorbida pasará a la ficha que se conserva. La absorbida dejará de existir.
          </DialogDescription>
        </DialogHeader>

        {step === "buscar" && (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/40 text-sm">
              <p className="font-medium text-foreground">Se conservará (ficha actual)</p>
              <p>
                {clienteConservar.nombre} {clienteConservar.apellido} · {clienteConservar.telefono}
              </p>
              <p className="text-xs text-muted-foreground mt-1">ID: {clienteConservar.id}</p>
            </div>
            <div className="space-y-2">
              <Label>Buscar duplicada a absorber</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre, teléfono o email…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") void handleBuscar()
                  }}
                />
                <Button type="button" variant="outline" onClick={() => void handleBuscar()} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {searchResults.length > 0 && (
              <ul className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {searchResults.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                      onClick={() => void handleElegirDrop(c)}
                    >
                      <span className="font-medium">
                        {c.nombre} {c.apellido}
                      </span>
                      <span className="text-muted-foreground"> · {c.telefono}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(step === "preview" || step === "confirm") && preview && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3 border-primary/40 bg-primary/5">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Se conserva</p>
                <p className="font-medium mt-1">
                  {preview.keep.nombre} {preview.keep.apellido}
                </p>
                <p className="text-sm text-muted-foreground">{preview.keep.telefono}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{preview.keep.id}</p>
              </div>
              <div className="rounded-md border p-3 border-destructive/40 bg-destructive/5">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Se absorbe y elimina</p>
                <p className="font-medium mt-1">
                  {preview.drop.nombre} {preview.drop.apellido}
                </p>
                <p className="text-sm text-muted-foreground">{preview.drop.telefono}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{preview.drop.id}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleIntercambiar()} disabled={previewLoading}>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Intercambiar roles
            </Button>
            <p className="text-sm text-muted-foreground">
              Se moverán: <strong>{preview.mover.citas}</strong> cita(s), <strong>{preview.mover.pagos}</strong> pago(s),{" "}
              <strong>{preview.mover.gift_cards}</strong> gift card(s).
            </p>
            {step === "confirm" && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p>Esta acción no se puede deshacer desde la aplicación.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-fusion">Escribe FUSIONAR para confirmar</Label>
                  <Input
                    id="confirm-fusion"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="FUSIONAR"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setStep("preview")} disabled={isSubmitting}>
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isSubmitting || confirmText.trim().toUpperCase() !== "FUSIONAR"}
                    onClick={() => void handleFusionar()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fusionando…
                      </>
                    ) : (
                      "Confirmar fusión"
                    )}
                  </Button>
                </div>
              </div>
            )}
            {step === "preview" && (
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setStep("buscar")}>
                  Cambiar duplicada
                </Button>
                <Button type="button" onClick={handleContinuarConfirm} disabled={previewLoading}>
                  Continuar
                </Button>
              </div>
            )}
          </div>
        )}

        {previewLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando vista previa…
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
