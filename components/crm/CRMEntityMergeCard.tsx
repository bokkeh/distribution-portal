'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type MergeOption = {
  id: string
  label: string
}

export function CRMEntityMergeCard({
  title,
  description,
  sourceLabel,
  targetLabel,
  options,
  action,
  sourceName,
  targetName,
}: {
  title: string
  description: string
  sourceLabel: string
  targetLabel: string
  options: MergeOption[]
  action: (formData: FormData) => Promise<void>
  sourceName: string
  targetName: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await action(formData)
        toast.success(`${title} complete`)
      } catch (error) {
        toast.error(`Unable to ${title.toLowerCase()}`, {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-900">{sourceLabel}</span>
          <select
            name={sourceName}
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="">Select source</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-900">{targetLabel}</span>
          <select
            name={targetName}
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="">Select target</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? 'Merging...' : title}
      </Button>
    </form>
  )
}
