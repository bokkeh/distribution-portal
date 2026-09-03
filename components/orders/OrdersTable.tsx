'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, GripVertical, Settings2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { CustomerRecordLink } from '@/components/crm/CustomerRecordLink'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatOrderPaymentMethodLabel, formatOrderTypeLabel } from '@/lib/orders/status'

export type OrderRow = {
  id: string
  total: string
  quantity: number
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
  shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
  orderType: 'paid' | 'sample'
  paymentStatus: string
  paymentMethod: string | null
  createdAt: Date | string
  customerId: string
  companyName: string | null
}

const COLUMN_OPTIONS = [
  { key: 'date', label: 'Date' },
  { key: 'orderId', label: 'Order #' },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Order Status' },
  { key: 'quantity', label: 'Qty' },
  { key: 'type', label: 'Order Type' },
  { key: 'payment', label: 'Payment' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'total', label: 'Total' },
] as const

type ColumnKey = (typeof COLUMN_OPTIONS)[number]['key']
type SortDirection = 'asc' | 'desc'

const DEFAULT_COLUMNS: ColumnKey[] = ['date', 'orderId', 'customer', 'status', 'quantity', 'type', 'payment', 'shipping', 'total']
const NUMERIC_COLUMNS = new Set<ColumnKey>(['quantity', 'total'])
const DEFAULT_DESCENDING_COLUMNS = new Set<ColumnKey>(['date', 'total', 'quantity'])
const COLUMNS_STORAGE_KEY = 'admin-orders-columns:v1'
const SORT_STORAGE_KEY = 'admin-orders-sort:v1'

function getDefaultSortDirection(column: ColumnKey): SortDirection {
  return DEFAULT_DESCENDING_COLUMNS.has(column) ? 'desc' : 'asc'
}

function getSortValue(order: OrderRow, column: ColumnKey): string | number {
  switch (column) {
    case 'orderId': return order.id
    case 'date': return new Date(order.createdAt).getTime()
    case 'customer': return order.companyName ?? ''
    case 'status': return order.status
    case 'quantity': return order.quantity
    case 'type': return order.orderType
    case 'payment': return order.paymentStatus
    case 'shipping': return order.shippingStatus
    case 'total': return Number(order.total)
    default: return ''
  }
}

function compareValues(left: string | number, right: string | number, direction: SortDirection) {
  let comparison = 0
  if (typeof left === 'number' && typeof right === 'number') comparison = left - right
  else comparison = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? comparison : -comparison
}

function readStoredColumns(): ColumnKey[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return DEFAULT_COLUMNS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS
    const next = parsed.filter((value): value is ColumnKey => COLUMN_OPTIONS.some((option) => option.key === value))
    return next.length ? next : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}

function readStoredSort(): { sortBy: ColumnKey; sortDirection: SortDirection } {
  const fallback = { sortBy: 'date' as ColumnKey, sortDirection: 'desc' as SortDirection }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { sortBy?: ColumnKey; sortDirection?: SortDirection }
    const sortBy = parsed.sortBy && COLUMN_OPTIONS.some((option) => option.key === parsed.sortBy) ? parsed.sortBy : fallback.sortBy
    const sortDirection = parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc' ? parsed.sortDirection : getDefaultSortDirection(sortBy)
    return { sortBy, sortDirection }
  } catch {
    return fallback
  }
}

function SortableColumnChip({ column, onRemove }: { column: { key: ColumnKey; label: string }; onRemove: (column: ColumnKey) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.key })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing" aria-label={`Reorder ${column.label}`}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span>{column.label}</span>
      <button type="button" onClick={() => onRemove(column.key)} className="text-slate-400 hover:text-slate-600" aria-label={`Hide ${column.label}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function renderHeaderCell({ column, sortBy, sortDirection, onSort }: { column: ColumnKey; sortBy: ColumnKey; sortDirection: SortDirection; onSort: (column: ColumnKey) => void }) {
  const option = COLUMN_OPTIONS.find((item) => item.key === column)
  const alignment = NUMERIC_COLUMNS.has(column) ? 'text-right' : 'text-left'
  const isActive = sortBy === column

  return (
    <th key={column} aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-6 py-3 text-xs font-medium uppercase text-muted-foreground ${alignment}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1.5 rounded-md px-1 py-1 transition-colors hover:bg-slate-200/70 hover:text-slate-950 ${NUMERIC_COLUMNS.has(column) ? 'ml-auto' : ''} ${isActive ? 'text-slate-950' : ''}`}
      >
        <span>{option?.label ?? column}</span>
        {isActive ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" />
        )}
      </button>
    </th>
  )
}

function renderCell(order: OrderRow, column: ColumnKey) {
  switch (column) {
    case 'orderId':
      return <td key={column} className="px-6 py-4 text-sm font-mono">#{order.id.slice(-8).toUpperCase()}</td>
    case 'date':
      return <td key={column} className="px-6 py-4 text-sm text-muted-foreground">{formatDate(order.createdAt)}</td>
    case 'customer':
      return <td key={column} className="px-6 py-4 text-sm font-medium"><CustomerRecordLink accountId={order.customerId} name={order.companyName ?? 'Unknown customer'} /></td>
    case 'status':
      return <td key={column} className="px-6 py-4"><OrderStatusBadge kind="order" status={order.status} /></td>
    case 'quantity':
      return <td key={column} className="px-6 py-4 text-right text-sm">{order.quantity}</td>
    case 'type':
      return <td key={column} className="px-6 py-4"><Badge variant="outline">{formatOrderTypeLabel(order.orderType)}</Badge></td>
    case 'payment':
      return <td key={column} className="px-6 py-4"><div className="flex flex-col items-start gap-1"><OrderStatusBadge kind="payment" status={order.paymentStatus} />{order.paymentMethod ? <span className="text-xs text-slate-500">{formatOrderPaymentMethodLabel(order.paymentMethod)}</span> : null}</div></td>
    case 'shipping':
      return <td key={column} className="px-6 py-4"><OrderStatusBadge kind="shipping" status={order.shippingStatus} /></td>
    case 'total':
      return <td key={column} className="px-6 py-4 text-right text-sm font-semibold">{formatCurrency(order.total)}</td>
    default:
      return <td key={column} className="px-6 py-4 text-sm text-muted-foreground">-</td>
  }
}

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [sortBy, setSortBy] = useState<ColumnKey>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [ready, setReady] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedColumns(readStoredColumns())
      const storedSort = readStoredSort()
      setSortBy(storedSort.sortBy)
      setSortDirection(storedSort.sortDirection)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(selectedColumns)) } catch {}
  }, [selectedColumns, ready])

  useEffect(() => {
    if (!ready) return
    try { window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortBy, sortDirection })) } catch {}
  }, [sortBy, sortDirection, ready])

  function handleSort(column: ColumnKey) {
    if (sortBy === column) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection(getDefaultSortDirection(column))
    }
  }

  function toggleColumn(column: ColumnKey) {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        if (prev.length === 1) return prev
        return prev.filter((value) => value !== column)
      }
      return [...prev, column]
    })
  }

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSelectedColumns((prev) => {
      const oldIndex = prev.indexOf(active.id as ColumnKey)
      const newIndex = prev.indexOf(over.id as ColumnKey)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const sortedOrders = useMemo(() => {
    return [...orders].sort((left, right) => compareValues(getSortValue(left, sortBy), getSortValue(right, sortBy), sortDirection))
  }, [orders, sortBy, sortDirection])

  const visibleColumnOptions = selectedColumns
    .map((key) => COLUMN_OPTIONS.find((option) => option.key === key))
    .filter((option): option is (typeof COLUMN_OPTIONS)[number] => Boolean(option))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowColumnPicker((prev) => !prev)}>
            <Settings2 className="h-4 w-4" />
            Customize Columns
          </Button>
          {showColumnPicker ? (
            <div className="absolute right-0 z-20 mt-2 w-[min(340px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Show / Hide Columns</p>
                  <p className="text-[11px] text-slate-500">Drag visible columns to reorder the table left to right.</p>
                </div>
                <button type="button" onClick={() => setShowColumnPicker(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-3 p-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Visible order</p>
                  <DndContext sensors={sensors} onDragEnd={handleColumnDragEnd}>
                    <SortableContext items={selectedColumns} strategy={horizontalListSortingStrategy}>
                      <div className="flex flex-wrap gap-2">
                        {visibleColumnOptions.map((column) => (
                          <SortableColumnChip key={column.key} column={column} onRemove={toggleColumn} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
                <div className="space-y-1.5">
                  {COLUMN_OPTIONS.map((option) => (
                    <label key={option.key} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={selectedColumns.includes(option.key)} onChange={() => toggleColumn(option.key)} className="accent-orange-600" />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px]">
          <thead className="border-b bg-slate-50 sticky top-0 z-10">
            <tr>
              {selectedColumns.map((column) => renderHeaderCell({ column, sortBy, sortDirection, onSort: handleSort }))}
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedOrders.length === 0 ? (
              <tr><td colSpan={selectedColumns.length + 1}><EmptyState icon={FileText} title="No orders yet" description="New orders will appear here." /></td></tr>
            ) : sortedOrders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50">
                {selectedColumns.map((column) => renderCell(order, column))}
                <td className="px-6 py-4"><Link href={`/admin/orders/${order.id}`}><Button variant="ghost" size="sm">View</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
