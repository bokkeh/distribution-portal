'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { assignRank } from '@/actions/progression'
import { formatRank, RANKS } from '@/lib/progression/ranks'
import type { ProgressionChangeType } from '@/db/schema'

const CHANGE_TYPE_LABEL: Record<ProgressionChangeType, string> = {
  initial: 'Initial assignment',
  promotion: 'Promotion',
  demotion: 'Move down a rank',
  correction: 'Correct an incorrectly assigned rank',
  temporary: 'Temporary assignment',
  scheduled_review: 'Scheduled review outcome',
}

export function RankChangeDialog({ userId, memberName, currentLevel, suggestedLevel, trigger }: {
  userId: string
  memberName: string
  currentLevel: number
  suggestedLevel?: number
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(suggestedLevel ?? Math.min(currentLevel + 1, 10))
  const [changeType, setChangeType] = useState<ProgressionChangeType>('promotion')
  const [isTemporary, setIsTemporary] = useState(false)
  const [temporaryUntil, setTemporaryUntil] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const verb = level > currentLevel ? 'Promote' : level < currentLevel ? 'Move' : 'Reassign'
  const confirmMessage = `${verb} ${memberName} from ${formatRank(currentLevel)} to ${formatRank(level)}?`

  function submit() {
    if (!reason.trim()) { setError('Please enter a reason for this change.'); return }
    setError(null)
    startTransition(async () => {
      try {
        await assignRank({
          userId,
          level,
          changeType,
          isTemporary,
          temporaryUntil: isTemporary && temporaryUntil ? temporaryUntil : null,
          reason,
          notes: notes || null,
          overriddenRequirements: overrideReason.trim() ? [{ key: 'general', reason: overrideReason.trim() }] : [],
        })
        setOpen(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Change rank</AlertDialogTitle>
          <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rc-level">New rank</Label>
              <select id="rc-level" value={level} onChange={e => setLevel(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                {RANKS.map(r => <option key={r.level} value={r.level}>{formatRank(r.level)}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="rc-type">Change type</Label>
              <select id="rc-type" value={changeType} onChange={e => setChangeType(e.target.value as ProgressionChangeType)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                {Object.entries(CHANGE_TYPE_LABEL).filter(([k]) => k !== 'scheduled_review').map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isTemporary} onChange={e => setIsTemporary(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Mark as a temporary assignment
          </label>
          {isTemporary && (
            <div>
              <Label htmlFor="rc-until">Temporary until</Label>
              <input id="rc-until" type="date" value={temporaryUntil} onChange={e => setTemporaryUntil(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
          )}

          <div>
            <Label htmlFor="rc-reason">Reason for this change <span className="text-red-500">*</span></Label>
            <textarea id="rc-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="e.g. Completed all Level 4 requirements ahead of schedule." />
          </div>

          <div>
            <Label htmlFor="rc-notes">Internal notes (optional)</Label>
            <textarea id="rc-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
          </div>

          <div>
            <Label htmlFor="rc-override">Override standard requirements (optional, documented)</Label>
            <textarea id="rc-override" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Leave blank unless bypassing an unmet requirement." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); submit() }} disabled={pending}>
            {pending ? 'Saving…' : confirmMessage}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
