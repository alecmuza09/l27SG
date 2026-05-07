"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSucursalesActivasFromDB, getSucursalesByIdsFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, type User } from "@/lib/auth"

interface SucursalSelectorProps {
  value?: string
  onChange?: (sucursalId: string) => void
  showAllOption?: boolean
}

export function SucursalSelector({ value, onChange, showAllOption = true }: SucursalSelectorProps) {
  const [open, setOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedValue, setSelectedValue] = useState(value || "all")
  const [sucursales, setSucursales] = useState<Sucursal[]>([])

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin')
  const userSucursalIds = currentUser?.sucursalIds ?? (currentUser?.sucursalId ? [currentUser.sucursalId] : [])
  const hasMultipleSucursales = isAdmin || userSucursalIds.length > 1

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    async function loadSucursales() {
      if (isAdmin) {
        const sucursalesData = await getSucursalesActivasFromDB()
        setSucursales(sucursalesData)
      } else if (userSucursalIds.length > 0) {
        const sucursalesData = await getSucursalesByIdsFromDB(userSucursalIds)
        if (sucursalesData.length > 0) {
          setSucursales(sucursalesData)
          if (!value && onChange) {
            onChange(sucursalesData[0].id)
            setSelectedValue(sucursalesData[0].id)
          }
        }
      }
    }
    if (currentUser) {
      loadSucursales()
    }
  }, [currentUser, isAdmin, userSucursalIds.join(',')])

  const handleSelect = (currentValue: string) => {
    setSelectedValue(currentValue)
    setOpen(false)
    onChange?.(currentValue)
  }

  const selectedSucursal = sucursales.find((s) => s.id === selectedValue)
  const displayText = selectedValue === "all" && isAdmin ? "Todas las Sucursales" : selectedSucursal?.nombre || "Seleccionar..."

  // Manager con una sola sucursal: mostrar como texto fijo
  if (!hasMultipleSucursales && sucursales.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
        <Building2 className="h-4 w-4" />
        <span className="text-sm font-medium">{sucursales[0]?.nombre || "Sucursal"}</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-transparent"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{displayText}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Buscar sucursal..." />
          <CommandList>
            <CommandEmpty>No se encontraron sucursales.</CommandEmpty>
            <CommandGroup>
              {showAllOption && isAdmin && hasMultipleSucursales && (
                <CommandItem value="all" onSelect={() => handleSelect("all")}>
                  <Check className={cn("mr-2 h-4 w-4", selectedValue === "all" ? "opacity-100" : "opacity-0")} />
                  Todas las Sucursales
                </CommandItem>
              )}
              {sucursales.map((sucursal) => (
                <CommandItem key={sucursal.id} value={sucursal.id} onSelect={() => handleSelect(sucursal.id)}>
                  <Check className={cn("mr-2 h-4 w-4", selectedValue === sucursal.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{sucursal.nombre}</span>
                    <span className="text-xs text-muted-foreground">{sucursal.ciudad}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
