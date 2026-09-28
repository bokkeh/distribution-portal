'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleStarterKitCompletion } from '@/actions/progression'
import { Check } from 'lucide-react'
import { formatDate } from './shared'
import type { ProgressionStarterKitCompletion, ProgressionStarterKitItem } from '@/db/schema'

export function StarterKitChecklist({ userId, items, canEdit }: {
  userId: string
  items: { item: ProgressionStarterKitItem; completion: ProgressionStarterKitCompletion | null }[]
  canEdit: boolean
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const completeCount = items.filter(i => i.completion?.completedAt).length

  function toggle(itemId: string, completed: boolean) {
    startTransition(async () => {
      await toggleStarterKitCompletion({ userId, itemId, completed })
      router.refresh()
    })
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{completeCount} of {items.length} Starter Kit items complete</p>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${items.length ? (completeCount / items.length) * 100 : 0}%`, background: '#c9a34e' }} />
      </div>
      <ul className="space-y-1.5">
        {items.map(({ item, completion }) => {
          const complete = !!completion?.completedAt
          return (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <label className="flex flex-1 items-center gap-2.5 text-sm">
                <button
                  type="button"
                  disabled={!canEdit || pending}
                  onClick={() => toggle(item.id, !complete)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-transparent bg-emerald-500 text-white' : 'border-slate-300'} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {complete && <Check className="h-3 w-3" />}
                </button>
                <span className={complete ? 'text-slate-500 line-through' : 'text-slate-800'}>{item.label}</span>
              </label>
              {item.tracksExpiry && completion?.expiresAt && (
                <span className="shrink-0 text-xs text-slate-400">Expires {formatDate(completion.expiresAt)}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
