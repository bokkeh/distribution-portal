'use client'

import { useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  updateCRMAccountInlineField,
  type InlineCRMAccountField,
  type InlineCRMAccountUpdate,
} from '@/actions/crm'
import { BUSINESS_TYPE_OPTIONS } from '@/lib/customers/business-types'
import { PAYMENT_TERM_OPTIONS } from '@/lib/orders/payment-terms'
import { cn } from '@/lib/utils'

export interface InlineAccountOption {
  value: string
  label: string
}

export interface InlineEditableAccountFields {
  businessType?: string | null
  regionId?: string | null
  regionName?: string | null
  paymentTerms?: string | null
  assignedSalesRepId?: string | null
  salesLeadName?: string | null
}

export const EMPTY_INLINE_ACCOUNT_OPTIONS: InlineAccountOption[] = []

export const INLINE_BUSINESS_TYPE_OPTIONS: InlineAccountOption[] = [
  { value: '', label: 'Unspecified' },
  ...BUSINESS_TYPE_OPTIONS,
]

export const INLINE_PAYMENT_TERM_OPTIONS: InlineAccountOption[] = PAYMENT_TERM_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}))

export function applyInlineAccountUpdate<T extends InlineEditableAccountFields>(
  account: T,
  update: InlineCRMAccountUpdate,
): T {
  if (update.field === 'businessType') return { ...account, businessType: update.value || null }
  if (update.field === 'regionId') {
    return { ...account, regionId: update.value || null, regionName: update.value ? update.label : null }
  }
  if (update.field === 'paymentTerms') return { ...account, paymentTerms: update.value }
  return {
    ...account,
    assignedSalesRepId: update.value || null,
    salesLeadName: update.value ? update.label : null,
  }
}

const FIELD_LABELS: Record<InlineCRMAccountField, string> = {
  businessType: 'type',
  regionId: 'region',
  paymentTerms: 'payment terms',
  salesLeadId: 'sales lead',
}

export function InlineAccountFieldSelect({
  accountId,
  accountName,
  field,
  value,
  currentLabel,
  options,
  onChange,
  toneColor,
  className,
}: {
  accountId: string
  accountName: string
  field: InlineCRMAccountField
  value: string | null | undefined
  currentLabel: string
  options: InlineAccountOption[]
  onChange: (update: InlineCRMAccountUpdate) => void
  toneColor?: string
  className?: string
}) {
  const [pending, startTransition] = useTransition()
  const selectedValue = value ?? ''

  function handleChange(nextValue: string) {
    if (nextValue === selectedValue || pending) return

    const nextLabel = options.find((option) => option.value === nextValue)?.label ?? nextValue
    const nextUpdate: InlineCRMAccountUpdate = { field, value: nextValue, label: nextLabel }
    const previousUpdate: InlineCRMAccountUpdate = { field, value: selectedValue, label: currentLabel }
    onChange(nextUpdate)

    startTransition(async () => {
      try {
        const saved = await updateCRMAccountInlineField(accountId, field, nextValue)
        onChange(saved)
        toast.success(`${FIELD_LABELS[field][0].toUpperCase()}${FIELD_LABELS[field].slice(1)} updated`)
      } catch (error) {
        onChange(previousUpdate)
        toast.error(error instanceof Error ? error.message : `Failed to update ${FIELD_LABELS[field]}`)
      }
    })
  }

  return (
    <div
      className={cn('relative inline-flex min-w-0 items-center', className)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {toneColor ? (
        <span className="pointer-events-none absolute left-2.5 z-10 h-2 w-2 rounded-full" style={{ backgroundColor: toneColor }} />
      ) : null}
      <select
        value={selectedValue}
        onChange={(event) => handleChange(event.target.value)}
        disabled={pending}
        aria-label={`Update ${FIELD_LABELS[field]} for ${accountName}`}
        title={`Tap to change ${FIELD_LABELS[field]}`}
        className={cn(
          'h-8 min-w-0 cursor-pointer appearance-none rounded-full border border-slate-200 bg-white py-1 pl-3 pr-8 text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-400 hover:bg-slate-50 focus:border-[#ff5a00] focus:ring-2 focus:ring-orange-100 disabled:cursor-wait disabled:opacity-70',
          toneColor && 'pl-6',
        )}
      >
        {options.map((option) => (
          <option key={option.value || '__unassigned__'} value={option.value}>{option.label}</option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="pointer-events-none absolute right-2 h-3.5 w-3.5 animate-spin text-[#ff5a00]" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
      )}
    </div>
  )
}
