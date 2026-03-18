import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: string | number) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export function formatDate(date: string | Date) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed)
}

/**
 * Formats a phone number for human-readable display.
 * Accepts E.164 (+12489339350), 10-digit (2489339350), or already-formatted strings.
 * Returns null if the input is null/undefined/empty.
 */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '')
  // US number: 10 digits or 11 digits starting with 1
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }
  // Fallback: return as-is if we can't parse it
  return phone
}

export function generateInvoiceNumber(sequence: number) {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(sequence).padStart(5, '0')}`
}
