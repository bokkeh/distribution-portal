'use client'

import { stopViewAsUser } from '@/actions/view-as'
import { Eye, ShieldCheck, X, ArrowRight } from 'lucide-react'
import { useTransition } from 'react'
import Link from 'next/link'

interface Props {
  viewingAsName?: string
  viewingAsEmail?: string
  isViewAsMode: boolean
}

export function ViewAsBanner({ viewingAsName, viewingAsEmail, isViewAsMode }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleStop() {
    startTransition(async () => {
      await stopViewAsUser()
    })
  }

  if (isViewAsMode) {
    return (
      <div className="fixed bottom-4 left-4 z-[100] bg-violet-600 text-white rounded-2xl shadow-xl px-4 py-3 flex flex-col gap-2 min-w-[220px] max-w-[280px]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
          <Eye className="w-3.5 h-3.5" />
          Viewing as
        </div>
        <div className="text-sm font-bold leading-tight">{viewingAsName}</div>
        <div className="text-xs opacity-70 -mt-1">{viewingAsEmail}</div>
        <button
          onClick={handleStop}
          disabled={isPending}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-white text-violet-700 hover:bg-violet-50 px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Exit &amp; Back to Admin
        </button>
      </div>
    )
  }

  // Plain admin browsing sales portal
  return (
    <div className="fixed bottom-4 left-4 z-[100] bg-white border border-slate-200 text-slate-700 rounded-2xl shadow-xl px-4 py-3 flex flex-col gap-2 min-w-[200px] max-w-[240px]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
        <ShieldCheck className="w-3.5 h-3.5" />
        Admin Mode
      </div>
      <p className="text-xs text-slate-500 leading-snug">You're viewing the sales portal as an admin.</p>
      <Link
        href="/admin"
        className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        Back to Admin Panel
      </Link>
    </div>
  )
}
