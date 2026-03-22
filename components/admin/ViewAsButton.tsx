'use client'

import { startViewAsUser } from '@/actions/view-as'
import { Eye, Loader2 } from 'lucide-react'
import { useTransition } from 'react'

interface Props {
  userId: string
  userName: string | null
}

export function ViewAsButton({ userId, userName }: Props) {
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
      className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
      {isPending ? 'Opening…' : `View as ${userName?.split(' ')[0] ?? 'User'}`}
    </button>
  )
}
