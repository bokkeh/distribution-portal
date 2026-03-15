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

export function generateInvoiceNumber(sequence: number) {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(sequence).padStart(5, '0')}`
}
