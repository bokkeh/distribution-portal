'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { AccountActivityItem } from '@/lib/crm/account-detail-data'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'orders', label: 'Orders' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'tastings', label: 'Tastings' },
  { value: 'calls', label: 'Calls' },
  { value: 'emails', label: 'Emails' },
  { value: 'sms', label: 'SMS' },
  { value: 'notes', label: 'Notes' },
  { value: 'profile_updates', label: 'Profile updates' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'system', label: 'System' },
] as const

function formatEventType(value: string) {
  return value.replace(/_/g, ' ')
}

function renderMetadata(metadata: Record<string, unknown>) {
  const changedFields = Array.isArray(metadata.changedFields) ? metadata.changedFields.filter((field): field is string => typeof field === 'string') : []
  const before = metadata.before
  const after = metadata.after
  const detailEntries = Object.entries(metadata).filter(([key]) => !['changedFields', 'before', 'after'].includes(key))

  if (changedFields.length === 0 && detailEntries.length === 0 && !before && !after) {
    return null
  }

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-medium text-slate-700">Details</summary>
      <div className="mt-2 space-y-2">
        {changedFields.length > 0 ? <p>Changed: {changedFields.join(', ')}</p> : null}
        {detailEntries.map(([key, value]) => (
          <p key={key}>
            <span className="font-medium">{formatEventType(key)}:</span>{' '}
            {typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
              ? String(value)
              : JSON.stringify(value)}
          </p>
        ))}
        {before || after ? (
          <div className="grid gap-2 md:grid-cols-2">
            {before ? (
              <div>
                <p className="font-medium text-slate-700">Before</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px]">{JSON.stringify(before, null, 2)}</pre>
              </div>
            ) : null}
            {after ? (
              <div>
                <p className="font-medium text-slate-700">After</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px]">{JSON.stringify(after, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  )
}

export function AccountActivityCard({ items }: { items: AccountActivityItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [visibleCount, setVisibleCount] = useState(15)

  const filteredItems = useMemo(
    () => items.filter((item) => filter === 'all' || item.category === filter),
    [filter, items]
  )

  const visibleItems = filteredItems.slice(0, visibleCount)

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Activity</CardTitle>
            <p className="text-sm text-slate-500">Complete account history, newest first.</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-400">{filteredItems.length} events</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value)
                setVisibleCount(15)
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === option.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {visibleItems.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded for this filter yet.</p>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <div key={item.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {formatEventType(item.eventType)}
                      </Badge>
                    </div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400" suppressHydrationWarning>
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.actorName ? `${item.actorName}${item.actorRole ? ` (${item.actorRole})` : ''}` : 'System'}</span>
                    <span>•</span>
                    <span>{item.sourceLabel}</span>
                    {item.relatedLabel ? (
                      <>
                        <span>•</span>
                        {item.relatedHref ? (
                          <Link href={item.relatedHref} className="font-medium text-blue-600 hover:underline">
                            {item.relatedLabel}
                          </Link>
                        ) : (
                          <span>{item.relatedLabel}</span>
                        )}
                      </>
                    ) : null}
                  </div>
                  {renderMetadata(item.metadata)}
                </div>
              </div>
            ))}
          </div>
        )}
        {visibleCount < filteredItems.length ? (
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + 15)}>
              Load more
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
