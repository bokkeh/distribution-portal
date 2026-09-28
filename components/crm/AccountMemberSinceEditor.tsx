'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { setAccountMemberSince } from '@/actions/crm-account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

export function AccountMemberSinceEditor({
  accountId,
  memberSince,
  suggestedDate,
  canEdit,
}: {
  accountId: string
  memberSince: string | null
  suggestedDate: Date | null
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(memberSince ?? (suggestedDate ? suggestedDate.toISOString().slice(0, 10) : ''))
  const [saved, setSaved] = useState(memberSince)
  const [isPending, startTransition] = useTransition()

  if (!canEdit && !saved && !suggestedDate) {
    return (
      <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Member since</p>
          <p className="text-sm font-semibold text-slate-500">Not set</p>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2 shadow-sm">
        <CalendarDays className="mr-1 h-4 w-4 shrink-0 text-blue-600" />
        <Input
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-7 w-36 text-xs"
        />
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={() => startTransition(async () => {
            const result = await setAccountMemberSince(accountId, value || null)
            if (result.error) {
              toast.error(result.error)
              return
            }
            setSaved(value || null)
            setEditing(false)
          })}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  const displayDate = saved
    ? formatDate(new Date(`${saved}T00:00:00`))
    : suggestedDate
      ? formatDate(suggestedDate)
      : 'Unknown'
  const isSuggested = !saved && Boolean(suggestedDate)

  return (
    <button
      type="button"
      onClick={() => canEdit && setEditing(true)}
      className="group flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:shadow-sm"
      disabled={!canEdit}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <CalendarDays className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Member since</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
          {displayDate}
          {isSuggested ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Suggested
            </span>
          ) : null}
        </span>
      </span>
      {canEdit && <Pencil className="ml-1 h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-blue-600" />}
    </button>
  )
}
