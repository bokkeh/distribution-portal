'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { removeAccountInventoryItem, upsertAccountInventoryItem } from '@/actions/crm-account'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AccountInventoryHistoryEvent, AccountInventoryItem } from '@/lib/crm/account-detail-data'
import { formatDate } from '@/lib/utils'

type ProductOption = {
  id: string
  name: string
  sku: string
  unit: string
  active: boolean
}

type HistoryRangeKey =
  | 'thisWeek'
  | '7d'
  | 'thisMonth'
  | '30d'
  | 'monthly'
  | 'quarterly'
  | 'yearly'

type InventoryHistoryPoint = {
  label: string
  cases: number
  bottles: number
  adjustments: number
}

const HISTORY_RANGE_OPTIONS: Array<{ value: HistoryRangeKey; label: string }> = [
  { value: 'thisWeek', label: 'This Week' },
  { value: '7d', label: '7 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: '30d', label: '30 Days' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

function roundInventoryValue(value: number) {
  return Math.round(value * 100) / 100
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date) {
  const next = startOfDay(date)
  next.setDate(next.getDate() + 1)
  next.setMilliseconds(-1)
  return next
}

function startOfWeek(date: Date) {
  const start = startOfDay(date)
  const diff = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - diff)
  return start
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1)
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

function addYears(date: Date, amount: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + amount)
  return next
}

function formatBucketLabel(date: Date, range: HistoryRangeKey) {
  if (range === 'yearly') {
    return date.getFullYear().toString()
  }
  if (range === 'quarterly') {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${String(date.getFullYear()).slice(-2)}`
  }
  if (range === 'monthly') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  if (range === 'thisMonth' || range === '30d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function buildHistoryBuckets(range: HistoryRangeKey, now: Date) {
  const buckets: Array<{ start: Date; end: Date; label: string }> = []

  if (range === 'thisWeek' || range === '7d') {
    const firstDay = range === 'thisWeek' ? startOfWeek(now) : startOfDay(addDays(now, -6))
    let cursor = firstDay
    while (cursor <= now) {
      buckets.push({
        start: startOfDay(cursor),
        end: endOfDay(cursor),
        label: formatBucketLabel(cursor, range),
      })
      cursor = addDays(cursor, 1)
    }
    return buckets
  }

  if (range === 'thisMonth' || range === '30d') {
    const firstDay = range === 'thisMonth' ? startOfMonth(now) : startOfDay(addDays(now, -29))
    let cursor = firstDay
    while (cursor <= now) {
      buckets.push({
        start: startOfDay(cursor),
        end: endOfDay(cursor),
        label: formatBucketLabel(cursor, range),
      })
      cursor = addDays(cursor, 1)
    }
    return buckets
  }

  if (range === 'monthly') {
    let cursor = startOfMonth(addMonths(now, -5))
    const limit = startOfMonth(addMonths(now, 1))
    while (cursor < limit) {
      buckets.push({
        start: startOfMonth(cursor),
        end: new Date(startOfMonth(addMonths(cursor, 1)).getTime() - 1),
        label: formatBucketLabel(cursor, range),
      })
      cursor = addMonths(cursor, 1)
    }
    return buckets
  }

  if (range === 'quarterly') {
    let cursor = startOfQuarter(addMonths(now, -9))
    const limit = startOfQuarter(addMonths(now, 3))
    while (cursor < limit) {
      buckets.push({
        start: startOfQuarter(cursor),
        end: new Date(startOfQuarter(addMonths(cursor, 3)).getTime() - 1),
        label: formatBucketLabel(cursor, range),
      })
      cursor = addMonths(cursor, 3)
    }
    return buckets
  }

  let cursor = startOfYear(addYears(now, -4))
  const limit = startOfYear(addYears(now, 1))
  while (cursor < limit) {
    buckets.push({
      start: startOfYear(cursor),
      end: new Date(startOfYear(addYears(cursor, 1)).getTime() - 1),
      label: formatBucketLabel(cursor, range),
    })
    cursor = addYears(cursor, 1)
  }
  return buckets
}

function buildInventoryHistorySeries(
  events: AccountInventoryHistoryEvent[],
  totalCases: number,
  totalBottles: number,
  range: HistoryRangeKey,
) {
  const now = new Date()
  const buckets = buildHistoryBuckets(range, now)
  const eventsAsc = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const allDeltaCases = eventsAsc.reduce((sum, event) => sum + event.deltaCases, 0)
  const allDeltaBottles = eventsAsc.reduce((sum, event) => sum + event.deltaBottles, 0)

  let runningCases = roundInventoryValue(totalCases - allDeltaCases)
  let runningBottles = roundInventoryValue(totalBottles - allDeltaBottles)
  let eventIndex = 0

  return buckets.map((bucket) => {
    let adjustments = 0

    while (eventIndex < eventsAsc.length && eventsAsc[eventIndex].createdAt <= bucket.end) {
      const event = eventsAsc[eventIndex]
      runningCases = roundInventoryValue(runningCases + event.deltaCases)
      runningBottles = roundInventoryValue(runningBottles + event.deltaBottles)
      if (event.createdAt >= bucket.start) {
        adjustments += 1
      }
      eventIndex += 1
    }

    return {
      label: bucket.label,
      cases: runningCases,
      bottles: runningBottles,
      adjustments,
    } satisfies InventoryHistoryPoint
  })
}

function InventoryHistoryChart({
  data,
}: {
  data: InventoryHistoryPoint[]
}) {
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.cases, point.bottles]))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="inventoryCasesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.16} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="inventoryBottlesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.14} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={44}
          domain={[0, Math.ceil(maxValue)]}
        />
        <Tooltip
          contentStyle={{ borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: 12 }}
          formatter={(value, name) => [
            `${Number(value ?? 0).toFixed(2)} ${name === 'cases' ? 'cases' : 'bottles'}`,
            name === 'cases' ? 'Cases on Hand' : 'Bottles on Hand',
          ]}
          labelFormatter={(label) => `Period: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="cases"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#inventoryCasesGradient)"
          activeDot={{ r: 4, fill: '#2563eb' }}
        />
        <Area
          type="monotone"
          dataKey="bottles"
          stroke="#059669"
          strokeWidth={2}
          fill="url(#inventoryBottlesGradient)"
          activeDot={{ r: 4, fill: '#059669' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function AccountInventoryOnHandCard({
  accountId,
  items,
  historyEvents,
  products,
  showHistory = false,
}: {
  accountId: string
  items: AccountInventoryItem[]
  historyEvents: AccountInventoryHistoryEvent[]
  products: ProductOption[]
  showHistory?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftCounts, setDraftCounts] = useState<Record<string, { casesOnHand: string; bottlesOnHand: string }>>(
    Object.fromEntries(items.map((item) => [item.id, { casesOnHand: item.casesOnHand, bottlesOnHand: item.bottlesOnHand }]))
  )
  const [selectedProductId, setSelectedProductId] = useState('')
  const [newCases, setNewCases] = useState('0')
  const [newBottles, setNewBottles] = useState('0')
  const [historyRange, setHistoryRange] = useState<HistoryRangeKey>('30d')

  const existingProductIds = new Set(items.map((item) => item.productId))
  const addableProducts = useMemo(
    () => products.filter((product) => !existingProductIds.has(product.id)),
    [products, items]
  )
  const totalCases = items.reduce((sum, item) => sum + Number(item.casesOnHand || 0), 0)
  const totalBottles = items.reduce((sum, item) => sum + Number(item.bottlesOnHand || 0), 0)
  const historySeries = useMemo(
    () => buildInventoryHistorySeries(historyEvents, totalCases, totalBottles, historyRange),
    [historyEvents, historyRange, totalBottles, totalCases]
  )
  const totalAdjustmentsInView = historySeries.reduce((sum, point) => sum + point.adjustments, 0)

  function refreshWithToast(message: string) {
    toast.success(message)
    router.refresh()
  }

  function saveProduct(productId: string, casesOnHand: string, bottlesOnHand: string) {
    const formData = new FormData()
    formData.append('accountId', accountId)
    formData.append('productId', productId)
    formData.append('casesOnHand', casesOnHand)
    formData.append('bottlesOnHand', bottlesOnHand)

    startTransition(async () => {
      const result = await upsertAccountInventoryItem(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      refreshWithToast('Inventory updated')
    })
  }

  function addProduct() {
    if (!selectedProductId) {
      toast.error('Choose a product to add')
      return
    }

    saveProduct(selectedProductId, newCases, newBottles)
    setSelectedProductId('')
    setNewCases('0')
    setNewBottles('0')
  }

  function removeItem(itemId: string) {
    if (!confirm('Remove this inventory item?')) return

    startTransition(async () => {
      const result = await removeAccountInventoryItem(itemId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      refreshWithToast('Inventory item removed')
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Total Inventory On Hand</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Update account-held inventory directly from the CRM record.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tracked inventory</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{totalCases.toFixed(2)} cases</p>
          <p className="text-sm font-medium text-slate-600">{totalBottles.toFixed(2)} bottles</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showHistory ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Inventory History</p>
                <p className="mt-1 text-xs text-slate-500">
                  Reconstructed from saved inventory adjustments and account activity timestamps.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  {totalAdjustmentsInView} adjustment{totalAdjustmentsInView === 1 ? '' : 's'} in range
                </div>
                <Select value={historyRange} onValueChange={(value) => setHistoryRange(value as HistoryRangeKey)}>
                  <SelectTrigger className="w-[160px] bg-white">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {HISTORY_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <InventoryHistoryChart data={historySeries} />

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                Cases on Hand
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                Bottles on Hand
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-medium">Product</th>
                <th className="pb-2 pr-3 font-medium">SKU</th>
                <th className="pb-2 pr-3 font-medium">Unit</th>
                <th className="pb-2 pr-3 font-medium">Cases on hand</th>
                <th className="pb-2 pr-3 font-medium">Bottles on hand</th>
                <th className="pb-2 pr-3 font-medium">Last updated</th>
                <th className="pb-2 pr-3 font-medium">By</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-sm text-slate-500">No account inventory tracked yet.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{item.sku}</td>
                    <td className="py-3 pr-3 text-slate-600">{item.unitType ?? 'unit'}</td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftCounts[item.id]?.casesOnHand ?? item.casesOnHand}
                        onChange={(event) => setDraftCounts((current) => ({
                          ...current,
                          [item.id]: {
                            casesOnHand: event.target.value,
                            bottlesOnHand: current[item.id]?.bottlesOnHand ?? item.bottlesOnHand,
                          },
                        }))}
                        className="h-9 w-28 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftCounts[item.id]?.bottlesOnHand ?? item.bottlesOnHand}
                        onChange={(event) => setDraftCounts((current) => ({
                          ...current,
                          [item.id]: {
                            casesOnHand: current[item.id]?.casesOnHand ?? item.casesOnHand,
                            bottlesOnHand: event.target.value,
                          },
                        }))}
                        className="h-9 w-28 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                      />
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500" suppressHydrationWarning>{formatDate(item.updatedAt)}</td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{item.updatedByName ?? 'System'}{item.updatedByRole ? ` (${item.updatedByRole})` : ''}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => saveProduct(
                            item.productId,
                            draftCounts[item.id]?.casesOnHand ?? item.casesOnHand,
                            draftCounts[item.id]?.bottlesOnHand ?? item.bottlesOnHand,
                          )}
                        >
                          <Save className="mr-1.5 h-3.5 w-3.5" />Save
                        </Button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Remove inventory item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto] md:items-start">
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Add product to account inventory</option>
              {addableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}){product.active ? '' : ' - inactive'}
                </option>
              ))}
            </select>
            <div className="space-y-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={newCases}
                onChange={(event) => setNewCases(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
                placeholder="Cases"
              />
              <p className="text-center text-xs font-medium text-slate-500">Cases on Hand</p>
            </div>
            <div className="space-y-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={newBottles}
                onChange={(event) => setNewBottles(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
                placeholder="Bottles"
              />
              <p className="text-center text-xs font-medium text-slate-500">Bottles on Hand</p>
            </div>
            <Button type="button" disabled={isPending || !selectedProductId} onClick={addProduct}>
              <Plus className="mr-2 h-4 w-4" />Add Product
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
