"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { normalizarNombre } from "@/lib/data/gastos"

type AprobadorInputProps = {
  value: string
  onChange: (value: string) => void
  sugerencias: string[]
  placeholder?: string
  className?: string
  id?: string
}

export function AprobadorInput({
  value,
  onChange,
  sugerencias,
  placeholder = "Nombre de quien aprobó…",
  className,
  id,
}: AprobadorInputProps) {
  const [open, setOpen] = useState(false)

  const q = normalizarNombre(value)
  const filtradas = q
    ? sugerencias.filter((n) => normalizarNombre(n).includes(q)).slice(0, 6)
    : []

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && filtradas.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
          {filtradas.map((nombre) => (
            <button
              key={nombre}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(nombre)
                setOpen(false)
              }}
            >
              {nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
