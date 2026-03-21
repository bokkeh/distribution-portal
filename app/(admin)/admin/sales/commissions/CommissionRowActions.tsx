'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveCommission, voidCommission } from '@/actions/sales-members'
import { db } from '@/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Trash2, Pencil, Loader2, X, Check } from 'lucide-react'

interface Props {
  commissionId: string
  currentAmount: string
  status: string
  currentUserId: string
}

export function CommissionRowActions({ commissionId, currentAmount, status, currentUserId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingAmount, setEditingAmount] = useState(false)
  const [amount, setAmount] = useState(currentAmount)
  const [confirmVoid, setConfirmVoid] = useState(false)

  function handleApprove() {
    startTransition(async () => {
      await approveCommission(commissionId, currentUserId)
      router.refresh()
    })
  }

  function handleVoid() {
    startTransition(async () => {
      await voidCommission(commissionId, currentUserId)
      setConfirmVoid(false)
      router.refresh()
    })
  }

  async function handleSaveAmount() {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return
    startTransition(async () => {
      // Direct DB update via server action — we do a fetch call to a simple endpoint
      const res = await fetch('/api/commissions/update-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commissionId, amount: parsed.toFixed(2) }),
      })
      if (res.ok) {
        setEditingAmount(false)
        router.refresh()
      }
    })
  }

  if (confirmVoid) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium">Void this?</span>
        <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={handleVoid} disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, void'}
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setConfirmVoid(false)}>No</Button>
      </div>
    )
  }

  if (editingAmount) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="h-7 w-24 text-xs"
          autoFocus
        />
        <Button size="icon" className="h-7 w-7" onClick={handleSaveAmount} disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingAmount(false); setAmount(currentAmount) }}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {status === 'pending' && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
          onClick={handleApprove}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          Approve
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-slate-400 hover:text-slate-700"
        onClick={() => setEditingAmount(true)}
        disabled={isPending || status === 'paid'}
        title="Edit amount"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-slate-400 hover:text-red-600"
        onClick={() => setConfirmVoid(true)}
        disabled={isPending || status === 'voided'}
        title="Void commission"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
