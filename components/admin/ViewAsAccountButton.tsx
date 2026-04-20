'use client'

import { startViewAsAccount } from '@/actions/view-as'
import { Eye, Loader2, AlertCircle } from 'lucide-react'
import { useTransition, useState } from 'react'

export function ViewAsAccountButton({ accountId, companyName }: { accountId: string; companyName: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handle() {
    setError(null)
    startTransition(async () => {
      const result = await startViewAsAccount(accountId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handle}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        {isPending ? 'Opening...' : `View as ${companyName.split(' ')[0]}`}
      </button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}
