'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, GitMerge } from 'lucide-react'

type MergeOption = {
  id: string
  label: string
  preview?: Record<string, string | null | undefined>
}

type PreviewField = {
  key: string
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
  previewFields,
}: {
  title: string
  description: string
  sourceLabel: string
  targetLabel: string
  options: MergeOption[]
  action: (formData: FormData) => Promise<void>
  sourceName: string
  targetName: string
  previewFields?: PreviewField[]
}) {
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')

  const sourceRecord = options.find(o => o.id === sourceId)
  const targetRecord = options.find(o => o.id === targetId)
  const showPreview = !!(
    previewFields?.length &&
    sourceRecord?.preview &&
    targetRecord?.preview &&
    sourceId &&
    targetId &&
    sourceId !== targetId
  )

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await action(formData)
        toast.success(`${title} complete`)
        setExpanded(false)
        setSourceId('')
        setTargetId('')
      } catch (error) {
        toast.error(`Unable to ${title.toLowerCase()}`, {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-slate-400" />
          : <ChevronDown className="h-4 w-4 text-slate-400" />
        }
      </button>

      {expanded && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 space-y-4">
          <p className="text-xs text-muted-foreground">{description}</p>

          <form action={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-900">{sourceLabel}</span>
                <select
                  name={sourceName}
                  value={sourceId}
                  onChange={e => setSourceId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  <option value="">Select source…</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-900">{targetLabel}</span>
                <select
                  name={targetName}
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  <option value="">Select target…</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {showPreview && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Merge Preview</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Highlighted rows differ between records. The target values are kept.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-32">Field</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-600">
                          {sourceRecord!.label}
                          <span className="ml-1 font-normal text-slate-400">(removed)</span>
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-700">
                          {targetRecord!.label}
                          <span className="ml-1 font-normal text-slate-400">(kept)</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {previewFields!.map(field => {
                        const srcVal = sourceRecord!.preview![field.key] ?? null
                        const tgtVal = targetRecord!.preview![field.key] ?? null
                        const different = srcVal !== tgtVal
                        return (
                          <tr key={field.key} className={different ? 'bg-amber-50/70' : ''}>
                            <td className="px-4 py-2 text-xs font-medium text-slate-500">{field.label}</td>
                            <td className={`px-4 py-2 text-xs ${different && srcVal ? 'text-red-600 line-through decoration-red-400' : 'text-slate-400'}`}>
                              {srcVal ?? <span className="italic text-slate-300">—</span>}
                            </td>
                            <td className={`px-4 py-2 text-xs ${different ? 'font-medium text-green-800' : 'text-slate-600'}`}>
                              {tgtVal ?? <span className="italic text-slate-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="outline"
              disabled={isPending || !sourceId || !targetId || sourceId === targetId}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 disabled:opacity-40"
            >
              {isPending ? 'Merging…' : `Confirm ${title}`}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
