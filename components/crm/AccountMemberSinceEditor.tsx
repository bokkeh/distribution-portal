'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
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

  if (!canEdit && !saved) {
    return <p className="text-xs text-slate-400">Member Since not set</p>
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
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

  return (
    <button
      type="button"
      onClick={() => canEdit && setEditing(true)}
      className="group flex items-center gap-1 text-xs text-slate-500"
      disabled={!canEdit}
    >
      <span>
        Member Since {saved ? formatDate(new Date(`${saved}T00:00:00`)) : suggestedDate ? `${formatDate(suggestedDate)} (suggested)` : 'unknown'}
      </span>
      {canEdit && <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />}
    </button>
  )
}
