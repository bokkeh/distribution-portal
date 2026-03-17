'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Home, X } from 'lucide-react'

export default function HombaseForm({
  currentAddress,
  onSave,
}: {
  currentAddress: string | null
  onSave: (formData: FormData) => Promise<{ success?: boolean; error?: string } | void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentAddress ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('originAddress', value.trim())
      const result = await onSave(formData)
      if (result && 'error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(value.trim() ? 'Starting location saved' : 'Starting location cleared')
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-700 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        {currentAddress ? (
          <span>Start: <span className="font-medium text-slate-700">{currentAddress}</span></span>
        ) : (
          <span className="hover:underline">Set starting location</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Home className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="123 Main St, Houston, TX"
        className="h-8 text-sm w-72"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
      />
      <Button size="sm" onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
