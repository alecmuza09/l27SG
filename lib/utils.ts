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
