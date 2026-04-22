'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateDealStage } from '@/actions/crm'
import { getDealStage, type PipelineStage } from '@/lib/deal-stages'

export function DealStageSelect({
  accountId,
  currentStage,
  stages,
  onStageChange,
  size = 'md',
}: {
  accountId: string
  currentStage: string | null | undefined
  stages: PipelineStage[]
  onStageChange?: (nextStage: string) => void
  size?: 'sm' | 'md'
}) {
  const [isPending, startTransition] = useTransition()
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null)
  const fallbackValue = currentStage ?? stages[0]?.stageKey ?? 'new_lead'
  const selectedValue = optimisticValue ?? fallbackValue

  const current = getDealStage(selectedValue, stages)

  function handleChange(value: string) {
    setOptimisticValue(value)
    startTransition(async () => {
      try {
        await updateDealStage(accountId, value)
        onStageChange?.(value)
        setOptimisticValue(null)
        toast.success('Deal stage updated')
      } catch {
        setOptimisticValue(null)
        toast.error('Failed to update stage')
      }
    })
  }

  const sizeClass = size === 'sm'
    ? 'text-xs h-7 px-2'
    : 'text-sm h-9 px-3'

  return (
    <select
      value={selectedValue}
      disabled={isPending}
      onChange={e => handleChange(e.target.value)}
      className={`rounded-md border font-medium focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${sizeClass} ${current.colorClass}`}
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.stageKey}>{stage.label}</option>
      ))}
    </select>
  )
}
