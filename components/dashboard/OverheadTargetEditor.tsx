'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Popover from '@radix-ui/react-popover'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import { setOverheadTarget } from '@/actions/dashboard'
import { Button } from '@/components/ui/button'

export type OverheadMonth = { monthKey: string; label: string; amount: number }

function OverheadRow({ month, onSaved }: { month: OverheadMonth; onSaved: (monthKey: string, amount: number) => void }) {
  const router = useRouter()
  const [value, setValue] = useState(String(month.amount))
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = Number(value) !== month.amount && value.trim() !== ''

  async function handleSave() {
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Enter a valid overhead amount')
      return
    }
    setIsSaving(true)
    const result = await setOverheadTarget({ monthKey: month.monthKey, amount })
    setIsSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    onSaved(month.monthKey, amount)
    toast.success(`${month.label} overhead updated`)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="w-16 shrink-0 text-sm text-slate-600">{month.label}</span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
        <input
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') handleSave() }}
          className="h-8 w-full rounded-md border border-slate-200 pl-5 pr-2 text-sm outline-none focus:border-[#3b82f6]"
        />
      </div>
      <Button type="button" size="sm" variant="outline" disabled={isSaving || !isDirty} onClick={handleSave}>
        Save
      </Button>
    </div>
  )
}

export function OverheadTargetEditor({ months }: { months: OverheadMonth[] }) {
  const [open, setOpen] = useState(false)
  const [localMonths, setLocalMonths] = useState(months)

  function handleSaved(monthKey: string, amount: number) {
    setLocalMonths((current) => current.map((month) => month.monthKey === monthKey ? { ...month, amount } : month))
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Overhead
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-72 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            Monthly overhead / profitability line
          </p>
          <div className="max-h-72 overflow-y-auto">
            {localMonths.map((month) => (
              <OverheadRow key={month.monthKey} month={month} onSaved={handleSaved} />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
