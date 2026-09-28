'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveStarterKitItem, removeStarterKitItem } from '@/actions/progression'
import type { ProgressionStarterKitItem } from '@/db/schema'
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react'

export function StarterKitEditor({ items }: { items: ProgressionStarterKitItem[] }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  function move(item: ProgressionStarterKitItem, dir: -1 | 1) {
    const idx = sorted.findIndex(i => i.id === item.id)
    const swapWith = sorted[idx + dir]
    if (!swapWith) return
    startTransition(async () => {
      await saveStarterKitItem({ id: item.id, label: item.label, description: item.description, tracksExpiry: item.tracksExpiry, sortOrder: swapWith.sortOrder })
      await saveStarterKitItem({ id: swapWith.id, label: swapWith.label, description: swapWith.description, tracksExpiry: swapWith.tracksExpiry, sortOrder: item.sortOrder })
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => { await removeStarterKitItem(id); router.refresh() })
  }

  return (
    <div className="space-y-2">
      {sorted.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5">
          <div className="flex flex-col">
            <button disabled={idx === 0 || pending} onClick={() => move(item, -1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button disabled={idx === sorted.length - 1 || pending} onClick={() => move(item, 1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
          </div>
          <span className="flex-1 text-sm text-slate-800">{item.label}</span>
          {item.tracksExpiry && <span className="text-xs text-slate-400">Tracks expiry</span>}
          <button onClick={() => remove(item.id)} disabled={pending} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <AddItemRow nextSortOrder={sorted.length} />
    </div>
  )
}

function AddItemRow({ nextSortOrder }: { nextSortOrder: number }) {
  const [label, setLabel] = useState('')
  const [tracksExpiry, setTracksExpiry] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function add() {
    if (!label.trim()) return
    startTransition(async () => {
      await saveStarterKitItem({ label, tracksExpiry, sortOrder: nextSortOrder })
      setLabel('')
      setTracksExpiry(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="New checklist item" className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        <input type="checkbox" checked={tracksExpiry} onChange={e => setTracksExpiry(e.target.checked)} /> Tracks expiry
      </label>
      <Button size="sm" variant="outline" disabled={pending || !label.trim()} onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
    </div>
  )
}
