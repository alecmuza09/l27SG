import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza un email removiendo acentos y caracteres especiales
 * que no son válidos según RFC 5322 para la parte local del email.
 * Esto es necesario porque Supabase Auth no acepta caracteres especiales.
 * 
 * @param email - Email a normalizar
 * @returns Email normalizado sin acentos ni caracteres especiales
 * 
 * @example
 * normalizeEmail('dirección@luna27.mx') // 'direccion@luna27.mx'
 * normalizeEmail('maría.gonzález@luna27.mx') // 'maria.gonzalez@luna27.mx'
 */
/**
 * Convierte una hora en formato 24h "HH:MM" a formato 12h "H:MM AM/PM"
 * @example formatHora12("14:30") → "2:30 PM"
 * @example formatHora12("09:00") → "9:00 AM"
 */
export function formatHora12(hora: string): string {
  if (!hora) return ""
  const [h, m] = hora.substring(0, 5).split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

export function normalizeEmail(email: string): string {
  if (!email) return email
  
  // Separar la parte local y el dominio
  const [localPart, ...domainParts] = email.toLowerCase().split('@')
  
  if (!localPart || domainParts.length === 0) {
    return email // Retornar original si el formato es inválido
  }
  
  const domain = domainParts.join('@') // Por si hay múltiples @ (aunque no debería)
  
  // Normalizar la parte local: remover acentos y caracteres especiales
  const normalizedLocal = localPart
    .normalize('NFD') // Descompone caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '') // Remueve diacríticos (acentos)
    .replace(/[^a-z0-9._+-]/g, '') // Solo permite letras, números y caracteres permitidos
  
  return `${normalizedLocal}@${domain}`
}
