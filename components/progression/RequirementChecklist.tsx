'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markRequirementComplete } from '@/actions/progression'
import { RequirementStatusIcon, requirementStatusLabel } from './shared'
import type { RequirementProgress } from '@/lib/progression/eligibility'
import { Button } from '@/components/ui/button'

function formatValue(req: RequirementProgress) {
  if (req.isQualitative) return null
  const cur = req.currentValue != null ? Math.round(req.currentValue * 10) / 10 : 0
  if (req.targetValue == null) return null
  return `${cur} / ${req.targetValue}`
}

export function RequirementChecklist({ userId, level, requirements, canMark, canOverride }: {
  userId: string
  level: number
  requirements: RequirementProgress[]
  canMark: boolean
  canOverride: boolean
}) {
  if (requirements.length === 0) {
    return <p className="text-sm text-slate-400">No requirements are configured for this rank yet.</p>
  }

  return (
    <ul className="space-y-2">
      {requirements.map(req => (
        <RequirementRow key={req.key} userId={userId} level={level} req={req} canMark={canMark} canOverride={canOverride} />
      ))}
    </ul>
  )
}

function RequirementRow({ userId, level, req, canMark, canOverride }: { userId: string; level: number; req: RequirementProgress; canMark: boolean; canOverride: boolean }) {
  const [showOverride, setShowOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const value = formatValue(req)
  const actionable = req.status !== 'complete' && req.status !== 'overridden'

  function mark(status: 'complete' | 'overridden', overrideReason?: string) {
    startTransition(async () => {
      await markRequirementComplete({ userId, level, requirementKey: req.key, status, reason: overrideReason })
      setShowOverride(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <RequirementStatusIcon status={req.status} className="mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-800">{req.label}{req.requirementType === 'recommended' && <span className="ml-1.5 text-[11px] font-normal text-slate-400">(recommended)</span>}{req.requirementType === 'optional' && <span className="ml-1.5 text-[11px] font-normal text-slate-400">(optional)</span>}</p>
            <p className="text-xs text-slate-400">{requirementStatusLabel(req.status)}{req.overrideReason ? ` — ${req.overrideReason}` : ''}</p>
          </div>
        </div>
        {value && <span className="shrink-0 text-sm font-semibold text-slate-700">{value}</span>}
      </div>

      {actionable && (canMark || canOverride) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
          {canMark && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => mark('complete')}>Mark complete</Button>
          )}
          {canOverride && !showOverride && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setShowOverride(true)}>Override…</Button>
          )}
          {showOverride && (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for override (required)"
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
              <Button size="sm" disabled={pending || !reason.trim()} onClick={() => mark('overridden', reason)}>Confirm override</Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
