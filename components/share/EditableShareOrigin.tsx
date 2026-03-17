'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Home, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function EditableShareOrigin({
  label = 'Home Base',
  address,
  onSave,
}: {
  label?: string
  address: string | null
  onSave: (formData: FormData) => Promise<{ success?: boolean; error?: string }>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!address)
  const [value, setValue] = useState(address ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('originAddress', value.trim())
      const result = await onSave(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(value.trim() ? 'Home base updated' : 'Home base cleared')
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">H</div>
      {editing ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter home base or starting address"
            className="h-8 text-sm"
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave()
              if (event.key === 'Escape') {
                setEditing(false)
                setValue(address ?? '')
              }
            }}
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
                setValue(address ?? '')
              }}
              disabled={isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-700">
              <Home className="h-3 w-3 shrink-0 text-slate-400" />
              {address}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Edit home base"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
