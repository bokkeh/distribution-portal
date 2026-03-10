'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateDealStage } from '@/actions/crm'
import { DEAL_STAGES, getDealStage } from '@/lib/deal-stages'

export function DealStageSelect({
  accountId,
  currentStage,
  size = 'md',
}: {
  accountId: string
  currentStage: string | null | undefined
  size?: 'sm' | 'md'
}) {
  const [isPending, startTransition] = useTransition()
  const current = getDealStage(currentStage)

  function handleChange(value: string) {
    startTransition(async () => {
      try {
        await updateDealStage(accountId, value)
        toast.success('Deal stage updated')
      } catch {
        toast.error('Failed to update stage')
      }
    })
  }

  const sizeClass = size === 'sm'
    ? 'text-xs h-7 px-2'
    : 'text-sm h-9 px-3'

  return (
    <select
      value={current.value}
      disabled={isPending}
      onChange={e => handleChange(e.target.value)}
      className={`rounded-md border font-medium focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${sizeClass} ${current.color}`}
    >
      {DEAL_STAGES.map(s => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  )
}
