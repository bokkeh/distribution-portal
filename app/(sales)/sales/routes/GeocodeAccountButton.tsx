'use client'

import { useTransition, useState } from 'react'
import { LocateFixed, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { geocodeAccount } from '@/actions/crm'
import { useRouter } from 'next/navigation'

export function GeocodeAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<'ok' | 'err' | null>(null)

  function handleClick() {
    const confirmed = window.confirm(
      'This will make a billable Google Geocoding API request for this account address. Continue?'
    )
    if (!confirmed) return

    setResult(null)
    startTransition(async () => {
      const res = await geocodeAccount(accountId)
      if (res.success) {
        setResult('ok')
        router.refresh()
      } else {
        setResult('err')
      }
    })
  }

  if (result === 'ok') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Geocoded
      </span>
    )
  }

  if (result === 'err') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
        <AlertCircle className="w-3.5 h-3.5" /> Failed
      </span>
    )
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
        Geocode
      </button>
      <p className="text-[10px] font-medium text-red-600">Billable geocode call</p>
    </div>
  )
}
