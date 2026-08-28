'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CalendarClock, Loader2, Save } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { updateOrderPlacedDate } from '@/actions/orders'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

type OrderHistoryItem = {
  id: string
  status: string
  total: string
  createdAt: string | Date
  orderHref: string | null
  isAssisted: boolean
}

type RangeKey = '7d' | '14d' | '30d' | '90d' | 'month' | 'quarter' | 'year' | 'all'
type BucketResolution = 'day' | 'week' | 'month' | 'year'

type NormalizedOrder = {
  id: string
  status: string
  total: string
  createdAt: Date
  orderHref: string | null
  isAssisted: boolean
}

type ChartPoint = {
  label: string
  orderCount: number
  revenue: number
  orderLabels: string[]
}

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

function normalizeOrder(order: OrderHistoryItem): NormalizedOrder {
  return {
    ...order,
    createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt),
  }
}

function toDateInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function startOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(23, 59, 59, 999)
  return next
}

function addDays(value: Date, amount: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function startOfQuarter(value: Date) {
  const startMonth = value.getMonth() - (value.getMonth() % 3)
  return new Date(value.getFullYear(), startMonth, 1)
}

function startOfYear(value: Date) {
  return new Date(value.getFullYear(), 0, 1)
}

function startOfWeek(value: Date) {
  const next = startOfDay(value)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

function addYears(value: Date, amount: number) {
  return new Date(value.getFullYear() + amount, 0, 1)
}

function getRangeStart(range: RangeKey, now: Date) {
  switch (range) {
    case '7d':
      return startOfDay(addDays(now, -6))
    case '14d':
      return startOfDay(addDays(now, -13))
    case '30d':
      return startOfDay(addDays(now, -29))
    case '90d':
      return startOfDay(addDays(now, -89))
    case 'month':
      return startOfMonth(now)
    case 'quarter':
      return startOfQuarter(now)
    case 'year':
      return startOfYear(now)
    case 'all':
    default:
      return null
  }
}

function getBucketResolution(range: RangeKey, firstDate: Date | null, now: Date): BucketResolution {
  if (range === '90d') return 'week'
  if (range === 'quarter' || range === 'year') return 'month'
  if (range === 'all') {
    if (!firstDate) return 'month'
    const spanDays = Math.ceil((now.getTime() - firstDate.getTime()) / 86_400_000)
    if (spanDays > 730) return 'year'
    return 'month'
  }
  return 'day'
}

function getBucketStart(value: Date, resolution: BucketResolution) {
  switch (resolution) {
    case 'week':
      return startOfWeek(value)
    case 'month':
      return startOfMonth(value)
    case 'year':
      return startOfYear(value)
    case 'day':
    default:
      return startOfDay(value)
  }
}

function advanceBucket(value: Date, resolution: BucketResolution) {
  switch (resolution) {
    case 'week':
      return addDays(value, 7)
    case 'month':
      return addMonths(value, 1)
    case 'year':
      return addYears(value, 1)
    case 'day':
    default:
      return addDays(value, 1)
  }
}

function formatBucketLabel(value: Date, resolution: BucketResolution) {
  switch (resolution) {
    case 'week':
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value)
    case 'month':
      return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(value)
    case 'year':
      return new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(value)
    case 'day':
    default:
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value)
  }
}

function getOrderStatusVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'fulfilled':
      return 'success'
    case 'confirmed':
      return 'info'
    case 'cancelled':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function buildChartData(orders: NormalizedOrder[], range: RangeKey, now: Date): ChartPoint[] {
  if (orders.length === 0) return []

  const earliestOrder = orders[orders.length - 1]
  const resolution = getBucketResolution(range, earliestOrder?.createdAt ?? null, now)
  const rangeStart = getRangeStart(range, now) ?? getBucketStart(earliestOrder.createdAt, resolution)
  const start = getBucketStart(rangeStart, resolution)
  const end = getBucketStart(now, resolution)
  const buckets = new Map<string, ChartPoint>()

  for (let cursor = start; cursor.getTime() <= end.getTime();) {
    const key = cursor.toISOString()
    buckets.set(key, {
      label: formatBucketLabel(cursor, resolution),
      orderCount: 0,
      revenue: 0,
      orderLabels: [],
    })
    cursor = advanceBucket(cursor, resolution)
  }

  for (const order of orders) {
    const bucketKey = getBucketStart(order.createdAt, resolution).toISOString()
    const bucket = buckets.get(bucketKey)
    if (!bucket) continue

    bucket.orderCount += 1
    bucket.revenue += Number(order.total)
    bucket.orderLabels.push(`#${order.id.slice(-8).toUpperCase()}`)
  }

  return Array.from(buckets.values())
}

function OrdersChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-900">{point.label}</p>
      <p className="mt-1 text-xs text-slate-600">{point.orderCount} order{point.orderCount === 1 ? '' : 's'}</p>
      <p className="text-xs text-slate-600">{formatCurrency(point.revenue)}</p>
      {point.orderLabels.length > 0 ? (
        <p className="mt-1 max-w-56 text-[11px] text-slate-500">
          {point.orderLabels.slice(0, 4).join(', ')}
          {point.orderLabels.length > 4 ? ` +${point.orderLabels.length - 4} more` : ''}
        </p>
      ) : null}
    </div>
  )
}

export function AccountOrderHistoryPanel({
  orders,
  canManagePlacedDates = false,
  className,
}: {
  orders: OrderHistoryItem[]
  canManagePlacedDates?: boolean
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [range, setRange] = useState<RangeKey>('90d')
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [draftDates, setDraftDates] = useState<Record<string, string>>({})
  const [createdAtOverrides, setCreatedAtOverrides] = useState<Record<string, string>>({})
  const now = useMemo(() => new Date(), [])
  const orderItems = useMemo(
    () =>
      [...orders]
        .map(normalizeOrder)
        .map((order) => ({
          ...order,
          createdAt: createdAtOverrides[order.id] ? new Date(createdAtOverrides[order.id]) : order.createdAt,
        }))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    [createdAtOverrides, orders]
  )

  const visibleOrders = useMemo(() => {
    const rangeStart = getRangeStart(range, now)
    if (!rangeStart) return orderItems

    const end = endOfDay(now)
    return orderItems.filter((order) => {
      const createdAt = order.createdAt.getTime()
      return createdAt >= rangeStart.getTime() && createdAt <= end.getTime()
    })
  }, [now, orderItems, range])

  const chartData = useMemo(
    () => buildChartData([...visibleOrders].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()), range, now),
    [now, range, visibleOrders]
  )

  const totalRevenue = visibleOrders.reduce((sum, order) => sum + Number(order.total), 0)
  const lastPlacedOrder = visibleOrders[0] ?? null
  const selectedRangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? 'Selected range'

  function savePlacedDate(orderId: string) {
    const nextPlacedDate = draftDates[orderId]
    const currentOrder = orderItems.find((order) => order.id === orderId)

    if (!currentOrder || !nextPlacedDate || nextPlacedDate === toDateInputValue(currentOrder.createdAt)) {
      return
    }

    setSavingOrderId(orderId)
    startTransition(async () => {
      const result = await updateOrderPlacedDate({ orderId, placedDate: nextPlacedDate })
      setSavingOrderId(null)

      if (result?.error) {
        toast.error(result.error)
        return
      }

      if (result?.createdAt) {
        setCreatedAtOverrides((current) => ({ ...current, [orderId]: result.createdAt }))
        setDraftDates((current) => ({ ...current, [orderId]: toDateInputValue(result.createdAt) }))
      }

      toast.success('Order placed date updated')
      router.refresh()
    })
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Order History
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Review when orders were placed, filter by common date windows, and backdate order entries from CRM.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} in range
            </div>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as RangeKey)}
              className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
              aria-label="Select order date range"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Range</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{selectedRangeLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Revenue in range</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last placed order</p>
            <p className="mt-1 text-lg font-bold text-slate-900" suppressHydrationWarning>
              {lastPlacedOrder ? formatDate(lastPlacedOrder.createdAt) : 'No orders'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-4 flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Order Timeline</p>
              <p className="mt-1 text-xs text-slate-500">
                Bars show how many orders were placed in each time bucket for the selected date range.
              </p>
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<OrdersChartTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
                  <Bar dataKey="orderCount" radius={[8, 8, 0, 0]} fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No orders fall inside the selected date range.</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-medium">Order</th>
                <th className="pb-2 pr-3 font-medium">Placed date</th>
                <th className="pb-2 pr-3 font-medium">Total</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-slate-500">No order history in the selected range.</td>
                </tr>
              ) : (
                visibleOrders.map((order) => {
                  const savedDate = toDateInputValue(order.createdAt)
                  const draftDate = draftDates[order.id] ?? savedDate
                  const hasChanges = draftDate !== savedDate
                  const isSaving = isPending && savingOrderId === order.id

                  return (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        {order.orderHref ? (
                          <Link href={order.orderHref} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                            #{order.id.slice(-8).toUpperCase()}
                          </Link>
                        ) : (
                          <p className="font-medium text-slate-900">#{order.id.slice(-8).toUpperCase()}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {canManagePlacedDates ? (
                          <input
                            type="date"
                            value={draftDate}
                            onChange={(event) => setDraftDates((current) => ({ ...current, [order.id]: event.target.value }))}
                            className="h-9 w-40 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                          />
                        ) : (
                          <span className="text-xs text-slate-500" suppressHydrationWarning>{formatDate(order.createdAt)}</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">{formatCurrency(order.total)}</td>
                      <td className="py-3 pr-3">
                        <Badge variant={getOrderStatusVariant(order.status)} className="text-xs">
                          {order.status}
                        </Badge>
                        {order.isAssisted ? <Badge variant="info" className="ml-2 text-xs">Assisted</Badge> : null}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {canManagePlacedDates ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!hasChanges || isSaving}
                              onClick={() => savePlacedDate(order.id)}
                            >
                              {isSaving ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Save
                            </Button>
                          ) : null}
                          {order.orderHref ? (
                            <Link href={order.orderHref} className="text-xs font-medium text-blue-600 hover:underline">
                              View order
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
