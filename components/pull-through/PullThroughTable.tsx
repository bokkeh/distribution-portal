'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Info } from 'lucide-react'
import {
  INVENTORY_META,
  NOT_ENOUGH_DATA,
  TEMPERATURE_META,
  fmtShortDate,
  orDash,
  scoreTone,
  urgencyChip,
} from '@/lib/pull-through/display'
import type { PullThroughAccountRow } from '@/lib/pull-through/types'

type SortKey =
  | 'account'
  | 'inventory'
  | 'lastOrder'
  | 'lastTasting'
  | 'reorders'
  | 'cadence'
  | 'daysSince'
  | 'daysOfInventory'
  | 'score'
  | 'temperature'

const NUMERIC_DESC_DEFAULT: SortKey[] = ['reorders', 'score', 'daysSince', 'inventory']

function sortValue(row: PullThroughAccountRow, key: SortKey): number | string | null {
  switch (key) {
    case 'account':
      return row.accountName.toLowerCase()
    case 'inventory':
      return row.inventory.bottles
    case 'lastOrder':
      return row.orders.lastOrderAt ? new Date(row.orders.lastOrderAt).getTime() : null
    case 'lastTasting':
      return row.tastings.lastTastingAt ? new Date(row.tastings.lastTastingAt).getTime() : null
    case 'reorders':
      return row.orders.reorderCount
    case 'cadence':
      return row.orders.avgDaysBetweenOrders
    case 'daysSince':
      return row.orders.daysSinceLastOrder
    case 'daysOfInventory':
      return row.inventory.estimatedDaysOfInventory
    case 'score':
      return row.pullThrough.score
    case 'temperature':
      return TEMPERATURE_META[row.temperature].order
    default:
      return null
  }
}

function SortHeader({
  label,
  sortAs,
  align = 'left',
  activeKey,
  onSort,
}: {
  label: string
  sortAs?: SortKey
  align?: 'left' | 'right'
  activeKey: SortKey
  onSort: (key: SortKey) => void
}) {
  const classes = `whitespace-nowrap px-3 py-2.5 ${
    align === 'right' ? 'text-right' : 'text-left'
  } text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`

  if (!sortAs) return <th className={classes}>{label}</th>

  return (
    <th className={classes}>
      <button
        type="button"
        onClick={() => onSort(sortAs)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 ${activeKey === sortAs ? 'text-slate-900' : ''}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  )
}

export function PullThroughTable({ rows }: { rows: PullThroughAccountRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('temperature')
  const [descending, setDescending] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((left, right) => {
      const a = sortValue(left, sortKey)
      const b = sortValue(right, sortKey)

      // Accounts we cannot measure sort last regardless of direction, so an empty
      // metric never masquerades as a good or bad one.
      if (a == null && b == null) return left.accountName.localeCompare(right.accountName)
      if (a == null) return 1
      if (b == null) return -1

      const comparison = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b)
      return descending ? -comparison : comparison
    })
    return copy
  }, [rows, sortKey, descending])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((value) => !value)
      return
    }
    setSortKey(key)
    setDescending(NUMERIC_DESC_DEFAULT.includes(key))
  }

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        No accounts match these filters.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <SortHeader label="Account" sortAs="account" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="City" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Market" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Sales Rep" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Current Inventory" sortAs="inventory" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Inv. Updated" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Last Order" sortAs="lastOrder" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Last Order Qty" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Last Tasting" sortAs="lastTasting" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Tasting Sales" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Taster" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Next Order After Tasting" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Tasting → Reorder" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Reorders" sortAs="reorders" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Avg Days Between" sortAs="cadence" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Days Since Order" sortAs="daysSince" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Est. Days of Inv." sortAs="daysOfInventory" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Pull-Through" sortAs="score" align="right" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Temperature" sortAs="temperature" activeKey={sortKey} onSort={toggleSort} />
            <SortHeader label="Recommended Action" activeKey={sortKey} onSort={toggleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const temp = TEMPERATURE_META[row.temperature]
            const inv = INVENTORY_META[row.inventory.confidence]
            const isOpen = expanded === row.accountId

            return (
              <tr key={row.accountId} className="border-b border-slate-50 align-top last:border-0 hover:bg-slate-50/50">
                <td className="px-3 py-3">
                  {/* Links to the existing account record — never a second copy of the customer. */}
                  <Link href={row.accountHref} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                    {row.accountName}
                  </Link>
                  {row.dataQuality.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-amber-600">
                      {row.dataQuality.length} data gap{row.dataQuality.length === 1 ? '' : 's'}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{orDash(row.city)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{orDash(row.market)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                  {row.salesRepName ?? <span className="text-amber-600">Unassigned</span>}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {row.inventory.bottles == null ? (
                    <span className="text-slate-400">Unknown</span>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-900">{Math.round(row.inventory.bottles)} btl</span>
                      <span className={`ml-1.5 inline-block rounded border px-1 py-px text-[10px] font-medium ${inv.chip}`}>
                        {inv.label}
                      </span>
                    </>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                  {row.inventory.lastConfirmedAt ? (
                    <>
                      {fmtShortDate(row.inventory.lastConfirmedAt)}
                      {row.inventory.lastConfirmedByName && (
                        <span className="block text-[11px] text-slate-400">by {row.inventory.lastConfirmedByName}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-600">Never</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-3">
                  {row.orders.lastOrderAt ? (
                    row.lastOrderSource?.href ? (
                      <Link href={row.lastOrderSource.href} className="text-blue-600 hover:underline">
                        {fmtShortDate(row.orders.lastOrderAt)}
                      </Link>
                    ) : (
                      fmtShortDate(row.orders.lastOrderAt)
                    )
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                  {row.orders.lastOrderBottles == null ? '—' : `${Math.round(row.orders.lastOrderBottles)} btl`}
                </td>

                <td className="whitespace-nowrap px-3 py-3">
                  {row.tastings.lastTastingAt ? (
                    row.lastTastingSource?.href ? (
                      <Link href={row.lastTastingSource.href} className="text-blue-600 hover:underline">
                        {fmtShortDate(row.tastings.lastTastingAt)}
                      </Link>
                    ) : (
                      fmtShortDate(row.tastings.lastTastingAt)
                    )
                  ) : (
                    <span className="text-slate-400">Never</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                  {row.tastings.lastTastingBottlesSold == null
                    ? row.tastings.hasEverHadTasting
                      ? <span className="text-amber-600">Not recorded</span>
                      : '—'
                    : `${row.tastings.lastTastingBottlesSold} btl`}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{orDash(row.tastings.lastTasterName)}</td>

                <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                  {row.tastings.lastTastingNextOrderAt ? fmtShortDate(row.tastings.lastTastingNextOrderAt) : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {row.tastings.lastTastingDaysToReorder == null ? (
                    '—'
                  ) : (
                    <span className="font-semibold text-slate-900">{row.tastings.lastTastingDaysToReorder}d</span>
                  )}
                </td>

                <td className="px-3 py-3 text-right font-semibold text-slate-900">{row.orders.reorderCount}</td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {row.orders.avgDaysBetweenOrders == null ? '—' : Math.round(row.orders.avgDaysBetweenOrders)}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {row.orders.daysSinceLastOrder ?? '—'}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {row.inventory.estimatedDaysOfInventory == null
                    ? '—'
                    : Math.round(row.inventory.estimatedDaysOfInventory)}
                </td>

                <td className="px-3 py-3 text-right">
                  {row.pullThrough.score == null ? (
                    <span className="text-[11px] text-slate-400">{NOT_ENOUGH_DATA}</span>
                  ) : (
                    <span className={`text-base font-bold ${scoreTone(row.pullThrough.score)}`}>
                      {row.pullThrough.score}
                    </span>
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${temp.chip}`}>
                    <span aria-hidden>{temp.emoji}</span>
                    {temp.label}
                  </span>
                </td>

                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.accountId)}
                    className={`inline-flex max-w-[240px] items-start gap-1 rounded-md border px-2 py-1 text-left text-[11px] font-semibold ${urgencyChip(row.recommendation.urgency)}`}
                  >
                    <span>{row.recommendation.label}</span>
                    <Info className="mt-px h-3 w-3 shrink-0 opacity-60" />
                  </button>
                  {isOpen && (
                    <div className="mt-2 max-w-[280px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Why</p>
                      <ul className="space-y-1">
                        {row.recommendation.why.map((reason) => (
                          <li key={reason} className="text-[11px] leading-snug text-slate-600">
                            • {reason}
                          </li>
                        ))}
                      </ul>
                      {row.dataQuality.length > 0 && (
                        <>
                          <p className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                            Data gaps
                          </p>
                          <ul className="space-y-1">
                            {row.dataQuality.map((flag) => (
                              <li key={flag.key} className="text-[11px] leading-snug">
                                {flag.href ? (
                                  <Link href={flag.href} className="text-blue-600 hover:underline">
                                    {flag.label}
                                  </Link>
                                ) : (
                                  <span className="text-slate-600">{flag.label}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <Link
                        href={`${row.accountHref}?tab=sales-intelligence`}
                        className="mt-2 inline-block text-[11px] font-medium text-blue-600 hover:underline"
                      >
                        Open Sales Intelligence →
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-muted-foreground">
        Showing {sorted.length} account{sorted.length === 1 ? '' : 's'}.
        Reorder cadence is derived from non-cancelled paid orders; sample drops are tracked separately.
        Badge counts are unavailable rather than estimated when the underlying record is missing.
      </div>
    </div>
  )
}
