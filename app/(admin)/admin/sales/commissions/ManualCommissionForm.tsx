'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createManualCommission } from '@/actions/sales-members'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, Loader2 } from 'lucide-react'
import type { SalesMemberWithUser } from '@/actions/sales-members'

const COMMISSION_TYPES = [
  { value: 'manual_bonus', label: 'Bonus' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'spiff', label: 'Spiff' },
  { value: 'penalty', label: 'Penalty' },
] as const

interface Props {
  members: SalesMemberWithUser[]
  currentUserId: string
}

export function ManualCommissionForm({ members, currentUserId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [memberId, setMemberId] = useState('none')
  const [type, setType] = useState<'manual_bonus' | 'adjustment' | 'spiff' | 'penalty'>('manual_bonus')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [reasonCode, setReasonCode] = useState('')

  function reset() {
    setMemberId('none')
    setType('manual_bonus')
    setAmount('')
    setDescription('')
    setNotes('')
    setEffectiveDate('')
    setReasonCode('')
    setError(null)
    setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (memberId === 'none') { setError('Select a sales rep.'); return }
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (!description.trim()) { setError('Description is required.'); return }

    startTransition(async () => {
      const result = await createManualCommission({
        salesMemberId: memberId,
        type,
        amount: parseFloat(amount),
        description: description.trim(),
        notes: notes.trim() || undefined,
        reasonCode: reasonCode.trim() || undefined,
        effectiveDate: effectiveDate || undefined,
        createdByAdminId: currentUserId,
      })
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.')
      } else {
        reset()
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Manual Commission
      </Button>
    )
  }

  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900 text-sm">New Manual Commission</p>
        <button onClick={reset} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Sales Rep *</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select rep..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select rep...</SelectItem>
                {members.filter(m => m.status === 'active').map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={type} onValueChange={v => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMISSION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Amount ($) *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="250.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description * <span className="text-slate-400 font-normal">(required for audit)</span></Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Q1 performance bonus — exceeded quota by 20%"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Reason Code</Label>
            <Input value={reasonCode} onChange={e => setReasonCode(e.target.value)} placeholder="e.g. QUOTA_EXCEED" />
          </div>

          <div className="space-y-1.5">
            <Label>Internal Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} size="sm">
            {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Create Commission
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={reset}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
