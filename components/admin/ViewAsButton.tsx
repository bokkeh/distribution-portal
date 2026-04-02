'use client'

import { startViewAsUser } from '@/actions/view-as'
import { Eye, Loader2 } from 'lucide-react'
import { useTransition } from 'react'

interface Props {
  userId: string
  userName: string | null
  label?: string
  className?: string
}

export function ViewAsButton({ userId, userName, label, className }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleViewAs() {
    startTransition(async () => {
      await startViewAsUser(userId)
    })
  }

  return (
    <button
      onClick={handleViewAs}
      disabled={isPending}
      className={
        className ??
        'flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50'
      }
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      {isPending ? 'Opening...' : (label ?? `View as ${userName?.split(' ')[0] ?? 'User'}`)}
    </button>
  )
}
