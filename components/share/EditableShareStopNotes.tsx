'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function EditableShareStopNotes({
  notes,
  onSave,
}: {
  notes: string | null
  onSave: (formData: FormData) => Promise<{ success?: boolean; error?: string }>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('notes', value.trim())
      const result = await onSave(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Stop notes updated')
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          placeholder="Add route notes for this stop."
          className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            <Check className="mr-1 h-3.5 w-3.5" />
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setValue(notes ?? '')
            }}
            disabled={isPending}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {notes ? (
          <p className="text-xs italic text-slate-400">{notes}</p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <StickyNote className="h-3 w-3 shrink-0" />
            No notes yet.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        title={notes ? 'Edit notes' : 'Add notes'}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
