'use client'

import Link from 'next/link'
import { PipelineCardSettings, type PipelineCardFieldOption, usePipelineCardFields } from './PipelineCardSettings'

export type CRMCollectionPipelineColumn = {
  id: string
  label: string
  description?: string
  toneClassName: string
  countClassName: string
}

export type CRMCollectionPipelineItem = {
  id: string
  columnId: string
  title: string
  href?: string | null
  details: Record<string, string | null | undefined>
}

export function CRMCollectionPipeline({
  title,
  description,
  storageKey,
  columns,
  items,
  fields,
  defaultFields,
}: {
  title: string
  description: string
  storageKey: string
  columns: CRMCollectionPipelineColumn[]
  items: CRMCollectionPipelineItem[]
  fields: PipelineCardFieldOption[]
  defaultFields: string[]
}) {
  const { selectedFields, toggleField, resetFields } = usePipelineCardFields({
    storageKey,
    options: fields,
    defaults: defaultFields,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-bold uppercase text-slate-950">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <PipelineCardSettings options={fields} selectedFields={selectedFields} onToggle={toggleField} onReset={resetFields} />
      </div>

      <div className="max-h-[calc(100vh-10rem)] overflow-auto overscroll-contain pb-6 pt-1 [scrollbar-color:#cbd5e1_transparent]">
        <div className="flex min-h-full items-stretch gap-6">
          {columns.map((column) => {
            const columnItems = items.filter((item) => item.columnId === column.id)
            return (
              <section key={column.id} className="flex w-[290px] shrink-0 flex-col self-stretch" aria-labelledby={`pipeline-column-${column.id}`}>
                <div className={`sticky top-0 z-20 rounded-2xl border p-4 shadow-sm ${column.toneClassName}`}>
                  <div className="flex min-h-9 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 id={`pipeline-column-${column.id}`} className="truncate font-display text-xl font-bold uppercase leading-none tracking-[0.02em] text-slate-900">{column.label}</h3>
                      {column.description ? <p className="mt-1 text-xs text-slate-600">{column.description}</p> : null}
                    </div>
                    <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-sm font-bold text-white ${column.countClassName}`}>{columnItems.length}</span>
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-3 rounded-2xl pb-2">
                  {columnItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
                      {item.href ? (
                        <Link href={item.href} className="font-semibold leading-tight text-slate-950 decoration-[#ff5a00] underline-offset-4 hover:text-[#d94c00] hover:underline">
                          {item.title}
                        </Link>
                      ) : (
                        <p className="font-semibold leading-tight text-slate-950">{item.title}</p>
                      )}
                      {fields.map((field) => {
                        if (!selectedFields.has(field.key)) return null
                        const value = item.details[field.key]
                        if (!value) return null
                        return (
                          <div key={field.key} className="mt-2 border-t border-slate-100 pt-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{field.label}</p>
                            <p className="mt-0.5 break-words text-sm text-slate-600">{value}</p>
                          </div>
                        )
                      })}
                    </article>
                  ))}
                  {columnItems.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-8 text-center text-xs text-slate-500">No records</p> : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
