"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSucursalesActivas, type Sucursal } from "@/lib/data/sucursales"

interface SucursalSelectorProps {
  value?: string
  onChange?: (sucursalId: string) => void
  showAllOption?: boolean
}

export function SucursalSelector({ value, onChange, showAllOption = true }: SucursalSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value || "all")
  const [sucursales, setSucursales] = useState<Sucursal[]>([])

  useEffect(() => {
    setSucursales(getSucursalesActivas())
  }, [])

  const handleSelect = (currentValue: string) => {
    setSelectedValue(currentValue)
    setOpen(false)
    onChange?.(currentValue)
  }

  const selectedSucursal = sucursales.find((s) => s.id === selectedValue)
  const displayText = selectedValue === "all" ? "Todas las Sucursales" : selectedSucursal?.nombre || "Seleccionar..."

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
              {showAllOption && (
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
