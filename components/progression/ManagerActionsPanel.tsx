'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { recommendPromotion, decideRecommendation, scheduleReview, requestReview, recordTrainingSession, completeReview } from '@/actions/progression'
import { formatRank } from '@/lib/progression/ranks'
import { formatDate } from './shared'
import type { ProgressionPromotionRecommendation, ProgressionReview } from '@/db/schema'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-slate-500">{label}<div className="mt-1">{children}</div></label>
}

const inputCls = 'block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm'

export function RecommendPromotionForm({ userId, nextLevel }: { userId: string; nextLevel: number }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Recommend promotion to {formatRank(nextLevel)}</Button>

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <Field label="Why do you recommend this promotion?">
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !reason.trim()} onClick={() => startTransition(async () => { await recommendPromotion({ userId, toLevel: nextLevel, reason }); setOpen(false); router.refresh() })}>Submit recommendation</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

export function DecideRecommendationPanel({ recommendation }: { recommendation: ProgressionPromotionRecommendation }) {
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function decide(decision: 'approved' | 'declined') {
    startTransition(async () => {
      await decideRecommendation({ recommendationId: recommendation.id, decision, reason: notes || `Recommendation ${decision}.`, notes })
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm text-amber-800">Pending recommendation to promote to {formatRank(recommendation.toLevel)}.</p>
      {recommendation.recommendedReason && <p className="text-xs text-amber-700">&ldquo;{recommendation.recommendedReason}&rdquo;</p>}
      <Field label="Decision notes (optional)">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide('approved')}>Approve &amp; promote</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide('declined')}>Decline</Button>
      </div>
    </div>
  )
}

export function ScheduleReviewForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Schedule review</Button>

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <Field label="Review date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
      <Field label="Reason"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputCls} /></Field>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !date} onClick={() => startTransition(async () => { await scheduleReview({ userId, scheduledFor: date, reason }); setOpen(false); router.refresh() })}>Schedule</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

export function PendingReviewBanner({ review, canComplete, overdue }: { review: ProgressionReview; canComplete: boolean; overdue: boolean }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <div className={`rounded-lg border p-3 text-sm ${overdue ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
      <p>{overdue ? 'Review overdue' : 'Review scheduled'} for {formatDate(review.scheduledFor)}{review.reason ? ` — ${review.reason}` : ''}.</p>
      {canComplete && (
        <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => startTransition(async () => { await completeReview({ reviewId: review.id }); router.refresh() })}>Mark review complete</Button>
      )}
    </div>
  )
}

export function RequestReviewButton() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Request a rank review</Button>

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <Field label="Why are you requesting a review?"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputCls} /></Field>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !reason.trim()} onClick={() => startTransition(async () => { await requestReview(reason); setOpen(false); router.refresh() })}>Submit request</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

export function RecordTrainingForm({ traineeUserId }: { traineeUserId: string }) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Record training session</Button>

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <Field label="Topic"><input value={topic} onChange={e => setTopic(e.target.value)} className={inputCls} /></Field>
      <Field label="Session date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
      <Field label="Notes (optional)"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} /></Field>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !topic.trim()} onClick={() => startTransition(async () => { await recordTrainingSession({ traineeUserId, topic, sessionDate: date, notes }); setOpen(false); router.refresh() })}>Save session</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}
