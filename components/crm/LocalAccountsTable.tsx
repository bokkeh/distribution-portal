'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  closestCenter,
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
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Building2, GripVertical, MapPin, Settings2, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toggleStarAccount, type InlineCRMAccountUpdate } from '@/actions/crm'
import { getCustomerSegmentLabel, getCustomerSourceLabel } from '@/lib/customers/account-segmentation'
import { getBusinessTypeColor } from '@/lib/customers/business-types'
import { formatPaymentTerms } from '@/lib/orders/payment-terms'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PipelineStage } from '@/lib/deal-stages'
import { PhoneSmsButton } from './PhoneSmsButton'
import { DealStageSelect } from './DealStageSelect'
import {
  applyInlineAccountUpdate,
  EMPTY_INLINE_ACCOUNT_OPTIONS,
  InlineAccountFieldSelect,
  INLINE_BUSINESS_TYPE_OPTIONS,
  INLINE_PAYMENT_TERM_OPTIONS,
  type InlineAccountOption,
} from './InlineAccountFieldSelect'

const PAGE_SIZE = 200

export interface AccountRow {
  id: string
  companyName: string
  firstName: string | null
  lastName: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  email: string | null
  phone: string | null
  contactName: string | null
  businessType: string | null
  customerSegment: string | null
  customerSource: string | null
  dealStage: string | null
  creditLimit: string
  balance: string
  paymentTerms: string | null
  assignedSalesRepId?: string | null
  salesLeadName?: string | null
  hubspotContactId: string | null
  hubspotCompanyId: string | null
  starred: boolean
  pendingCases: number
  totalCasesPurchased: number
  healthScore: number
  lastActivityAt: string | Date | null
  regionId?: string | null
  regionName?: string | null
  orderCount?: number
  daysSinceLastOrder?: number | null
  pullThroughScore?: number | null
  inventoryBottlesOnHand: number
  lastInventoryCheckAt: string | Date | null
  daysSinceLastInventoryCheck: number | null
}

const COLUMN_OPTIONS = [
  { key: 'company', label: 'Name' },
  { key: 'region', label: 'Region' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'orders', label: 'Orders' },
  { key: 'daysSinceOrder', label: 'Days Since Order' },
  { key: 'pullThrough', label: 'Pull-Through' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'location', label: 'City / State' },
  { key: 'address', label: 'Street Address' },
  { key: 'zip', label: 'Zip Code' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'contactName', label: 'Primary Contact' },
  { key: 'businessType', label: 'Type' },
  { key: 'segment', label: 'Segment' },
  { key: 'source', label: 'Source' },
  { key: 'dealStage', label: 'Deal Stage' },
  { key: 'salesLead', label: 'Sales Lead' },
  { key: 'terms', label: 'Terms' },
  { key: 'creditLimit', label: 'Credit Limit' },
  { key: 'pendingCases', label: 'Pending Cases' },
  { key: 'totalPurchased', label: 'Total Purchased' },
  { key: 'balance', label: 'Balance' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'hubspot', label: 'HubSpot' },
  { key: 'health', label: 'Health Score' },
] as const

type ColumnKey = (typeof COLUMN_OPTIONS)[number]['key']
type SortKey = ColumnKey
type SortDirection = 'asc' | 'desc'
type ActivityWindowKey = 'all' | '1d' | '3d' | '7d' | '14d' | '30d'

const PREVIOUS_ADMIN_DEFAULT_COLUMNS: ColumnKey[] = ['company', 'phone', 'businessType', 'region', 'orders', 'daysSinceOrder', 'pullThrough']
const ADMIN_DEFAULT_COLUMNS: ColumnKey[] = ['company', 'phone', 'businessType', 'region', 'inventory', 'orders', 'daysSinceOrder', 'pullThrough']
const STANDARD_DEFAULT_COLUMNS: ColumnKey[] = ['company', 'location', 'phone', 'dealStage', 'terms', 'pendingCases', 'totalPurchased', 'balance', 'health', 'hubspot']
const NUMERIC_COLUMNS = new Set<ColumnKey>(['creditLimit', 'pendingCases', 'totalPurchased', 'balance', 'health', 'inventory', 'orders', 'daysSinceOrder', 'pullThrough'])
const DEFAULT_DESCENDING_COLUMNS = new Set<SortKey>(['creditLimit', 'pendingCases', 'totalPurchased', 'balance', 'lastActivity', 'health', 'inventory', 'orders', 'pullThrough'])
const ACTIVITY_WINDOW_OPTIONS: Array<{ value: ActivityWindowKey; label: string }> = [
  { value: 'all', label: 'Touched: Anytime' },
  { value: '1d', label: 'Touched: Yesterday' },
  { value: '3d', label: 'Touched: Last 3 Days' },
  { value: '7d', label: 'Touched: Last 7 Days' },
  { value: '14d', label: 'Touched: Last 14 Days' },
  { value: '30d', label: 'Touched: Last 30 Days' },
]

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getDefaultSortDirection(column: SortKey): SortDirection {
  return DEFAULT_DESCENDING_COLUMNS.has(column) ? 'desc' : 'asc'
}

function getAccountSortValue(
  account: AccountRow,
  column: SortKey,
  stageOrder: Map<string, number>,
): string | number | null {
  switch (column) {
    case 'company': return account.companyName
    case 'firstName': return account.firstName
    case 'lastName': return account.lastName
    case 'location': return [account.city, account.state].filter(Boolean).join(', ') || null
    case 'address': return account.address
    case 'zip': return account.zip
    case 'phone': return account.phone?.replace(/\D/g, '') || null
    case 'email': return account.email
    case 'contactName': return account.contactName
    case 'businessType': return account.businessType
    case 'region': return account.regionName ?? null
    case 'inventory': return account.lastInventoryCheckAt ? account.inventoryBottlesOnHand : null
    case 'orders': return account.orderCount ?? null
    case 'daysSinceOrder': return account.daysSinceLastOrder ?? null
    case 'pullThrough': return account.pullThroughScore ?? null
    case 'segment': return account.customerSegment
    case 'source': return account.customerSource
    case 'dealStage': return account.dealStage ? (stageOrder.get(account.dealStage) ?? Number.MAX_SAFE_INTEGER) : null
    case 'salesLead': return account.salesLeadName ?? null
    case 'terms': return account.paymentTerms ?? 'PREPAID'
    case 'creditLimit': return Number(account.creditLimit ?? 0)
    case 'pendingCases': return account.pendingCases
    case 'totalPurchased': return account.totalCasesPurchased
    case 'balance': return Number(account.balance ?? 0)
    case 'lastActivity': return normalizeDate(account.lastActivityAt)?.getTime() ?? null
    case 'hubspot': return account.hubspotCompanyId || account.hubspotContactId ? 1 : 0
    case 'health': return account.healthScore
  }
}

function compareSortValues(left: string | number | null, right: string | number | null, direction: SortDirection) {
  const leftMissing = left === null || left === ''
  const rightMissing = right === null || right === ''
  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1
  const comparison = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? comparison : -comparison
}

function getActivityThreshold(window: ActivityWindowKey) {
  if (window === 'all') return null

  const days = window === '1d' ? 1 : Number(window.replace('d', ''))
  if (!Number.isFinite(days)) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  now.setDate(now.getDate() - days)
  return now
}

function readStoredColumns(storageKey: string, defaultColumns: ColumnKey[]): ColumnKey[] {
  if (typeof window === 'undefined') return defaultColumns

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaultColumns
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultColumns
    const next = parsed.filter((value): value is ColumnKey =>
      COLUMN_OPTIONS.some((option) => option.key === value)
    )
    const isPreviousDefault = defaultColumns === ADMIN_DEFAULT_COLUMNS && (
      (next.length === STANDARD_DEFAULT_COLUMNS.length
        && next.every((column, index) => column === STANDARD_DEFAULT_COLUMNS[index]))
      || (next.length === PREVIOUS_ADMIN_DEFAULT_COLUMNS.length
        && next.every((column, index) => column === PREVIOUS_ADMIN_DEFAULT_COLUMNS[index]))
    )
    if (isPreviousDefault) return ADMIN_DEFAULT_COLUMNS
    return next.length ? next : defaultColumns
  } catch {
    return defaultColumns
  }
}

function readStoredView(filterStorageKey: string): {
  searchQuery: string
  sortBy: SortKey
  sortDirection: SortDirection
  activityWindow: ActivityWindowKey
} {
  if (typeof window === 'undefined') {
    return { searchQuery: '', sortBy: 'company', sortDirection: 'asc', activityWindow: 'all' }
  }

  try {
    const raw = window.localStorage.getItem(filterStorageKey)
    if (!raw) return { searchQuery: '', sortBy: 'company', sortDirection: 'asc', activityWindow: 'all' }
    const parsed = JSON.parse(raw) as { searchQuery?: string; sortBy?: SortKey; sortDirection?: SortDirection; activityWindow?: ActivityWindowKey }
    const validSortBy = COLUMN_OPTIONS.map((option) => option.key)
    const validActivityWindows: ActivityWindowKey[] = ['all', '1d', '3d', '7d', '14d', '30d']
    const sortBy = parsed.sortBy && validSortBy.includes(parsed.sortBy) ? parsed.sortBy : 'company'
    return {
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
      sortBy,
      sortDirection: parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc'
        ? parsed.sortDirection
        : getDefaultSortDirection(sortBy),
      activityWindow: parsed.activityWindow && validActivityWindows.includes(parsed.activityWindow) ? parsed.activityWindow : 'all',
    }
  } catch {
    return { searchQuery: '', sortBy: 'company', sortDirection: 'asc', activityWindow: 'all' }
  }
}

function SortableColumnChip({
  column,
  onRemove,
}: {
  column: { key: ColumnKey; label: string }
  onRemove: (column: ColumnKey) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        aria-label={`Reorder ${column.label}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span>{column.label}</span>
      <button type="button" onClick={() => onRemove(column.key)} className="text-slate-400 hover:text-slate-600" aria-label={`Hide ${column.label}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function renderHeaderCell({
  column,
  sortBy,
  sortDirection,
  onSort,
}: {
  column: ColumnKey
  sortBy: SortKey
  sortDirection: SortDirection
  onSort: (column: SortKey) => void
}) {
  const option = COLUMN_OPTIONS.find((item) => item.key === column)
  const alignment = NUMERIC_COLUMNS.has(column) ? 'text-right' : 'text-left'
  const isActive = sortBy === column
  const sortLabel = isActive
    ? `${option?.label ?? column}, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Activate to sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}.`
    : `${option?.label ?? column}. Activate to sort ${getDefaultSortDirection(column) === 'asc' ? 'ascending' : 'descending'}.`

  return (
    <th
      key={column}
      aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground ${alignment}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={sortLabel}
        className={`group inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-slate-200/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a00] ${
          NUMERIC_COLUMNS.has(column) ? 'ml-auto' : ''
        } ${isActive ? 'text-[#d94c00]' : ''}`}
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

function renderAccountCell({
  account,
  column,
  basePath,
  pipelineStages,
  onStageChange,
  onInlineChange,
  regionColors,
  regionOptions,
  salesLeadOptions,
  canAssignSalesLead,
}: {
  account: AccountRow
  column: ColumnKey
  basePath: string
  pipelineStages: PipelineStage[]
  onStageChange: (accountId: string, nextStage: string) => void
  onInlineChange: (accountId: string, update: InlineCRMAccountUpdate) => void
  regionColors: Record<string, string>
  regionOptions: InlineAccountOption[]
  salesLeadOptions: InlineAccountOption[]
  canAssignSalesLead: boolean
}) {
  switch (column) {
    case 'company':
      return (
        <td key={column} className="px-4 py-3">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
            <Link
              href={`${basePath}/${account.id}`}
              className="text-sm font-medium text-slate-900 underline-offset-4 transition hover:text-[#ff5a00] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a00]"
            >
              {account.companyName}
            </Link>
              <p className="mt-0.5 max-w-72 truncate text-xs text-slate-400">{[account.address, account.city, account.state].filter(Boolean).join(', ') || 'Address not entered'}</p>
            </div>
          </div>
        </td>
      )
    case 'firstName':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.firstName ?? '-'}</td>
    case 'lastName':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.lastName ?? '-'}</td>
    case 'location':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{[account.city, account.state].filter(Boolean).join(', ') || '-'}</td>
    case 'address':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.address ?? '-'}</td>
    case 'zip':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.zip ?? '-'}</td>
    case 'phone':
      return (
        <td key={column} className="px-4 py-3 text-sm">
          {account.phone ? (
            <PhoneSmsButton phone={account.phone} recipientName={account.companyName} />
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
      )
    case 'email':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.email ?? '-'}</td>
    case 'contactName':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.contactName ?? '-'}</td>
    case 'businessType':
      return (
        <td key={column} className="px-4 py-3">
          <InlineAccountFieldSelect
            accountId={account.id}
            accountName={account.companyName}
            field="businessType"
            value={account.businessType}
            currentLabel={account.businessType ?? 'Unspecified'}
            options={INLINE_BUSINESS_TYPE_OPTIONS}
            toneColor={getBusinessTypeColor(account.businessType)}
            onChange={(update) => onInlineChange(account.id, update)}
          />
        </td>
      )
    case 'region': {
      const color = account.regionName ? regionColors[account.regionName] : undefined
      return (
        <td key={column} className="px-4 py-3 text-sm text-slate-600">
          <InlineAccountFieldSelect
            accountId={account.id}
            accountName={account.companyName}
            field="regionId"
            value={account.regionId}
            currentLabel={account.regionName ?? 'Unassigned'}
            options={regionOptions}
            toneColor={color ?? '#94A3B8'}
            onChange={(update) => onInlineChange(account.id, update)}
          />
        </td>
      )
    }
    case 'inventory':
      return (
        <td key={column} className="px-4 py-3 text-right">
          {account.lastInventoryCheckAt ? (
            <div className="inline-flex min-w-28 flex-col items-end">
              <p className="font-mono text-sm font-semibold text-slate-900">
                {account.inventoryBottlesOnHand.toLocaleString(undefined, { maximumFractionDigits: 2 })} bottles
              </p>
              <p className="text-xs text-slate-400" suppressHydrationWarning>
                {formatDate(account.lastInventoryCheckAt)}
                {account.daysSinceLastInventoryCheck == null ? '' : ` · ${account.daysSinceLastInventoryCheck}d ago`}
              </p>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </td>
      )
    case 'orders':
      return <td key={column} className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{account.orderCount || '—'}</td>
    case 'daysSinceOrder':
      return <td key={column} className="px-4 py-3 text-right font-mono text-sm text-slate-700">{account.daysSinceLastOrder == null ? '—' : `${account.daysSinceLastOrder}d`}</td>
    case 'pullThrough': {
      const score = account.pullThroughScore
      const tone = score == null ? 'bg-slate-300' : score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
      return (
        <td key={column} className="px-4 py-3 text-right">
          <div className="ml-auto w-24">
            <p className="font-mono text-sm font-bold text-slate-900">{score == null ? '—' : `${score}%`}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${tone}`} style={{ width: `${score ?? 0}%` }} /></div>
          </div>
        </td>
      )
    }
    case 'segment':
      return (
        <td key={column} className="px-4 py-3">
          <Badge variant={account.customerSegment === 'b2c_consumer' ? 'outline' : 'secondary'}>
            {getCustomerSegmentLabel(account.customerSegment)}
          </Badge>
        </td>
      )
    case 'source':
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{getCustomerSourceLabel(account.customerSource)}</td>
    case 'dealStage':
      return (
        <td key={column} className="px-4 py-3">
          <DealStageSelect
            accountId={account.id}
            currentStage={account.dealStage}
            stages={pipelineStages}
            size="sm"
            onStageChange={(nextStage) => onStageChange(account.id, nextStage)}
          />
        </td>
      )
    case 'salesLead':
      return (
        <td key={column} className="px-4 py-3 text-sm text-muted-foreground">
          {canAssignSalesLead ? (
            <InlineAccountFieldSelect
              accountId={account.id}
              accountName={account.companyName}
              field="salesLeadId"
              value={account.assignedSalesRepId}
              currentLabel={account.salesLeadName ?? 'Unassigned'}
              options={salesLeadOptions}
              onChange={(update) => onInlineChange(account.id, update)}
            />
          ) : account.salesLeadName ?? '-'}
        </td>
      )
    case 'terms':
      return (
        <td key={column} className="px-4 py-3">
          <InlineAccountFieldSelect
            accountId={account.id}
            accountName={account.companyName}
            field="paymentTerms"
            value={account.paymentTerms ?? 'PREPAID'}
            currentLabel={formatPaymentTerms(account.paymentTerms ?? 'PREPAID')}
            options={INLINE_PAYMENT_TERM_OPTIONS}
            onChange={(update) => onInlineChange(account.id, update)}
          />
        </td>
      )
    case 'creditLimit':
      return <td key={column} className="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(account.creditLimit ?? '0')}</td>
    case 'pendingCases':
      return (
        <td key={column} className="px-4 py-3 text-right text-sm font-medium">
          {account.pendingCases > 0 ? (
            <span className="text-amber-600">{account.pendingCases.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
      )
    case 'totalPurchased':
      return (
        <td key={column} className="px-4 py-3 text-right text-sm font-medium">
          {account.totalCasesPurchased > 0 ? account.totalCasesPurchased.toLocaleString() : '-'}
        </td>
      )
    case 'balance':
      return <td key={column} className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(account.balance ?? '0')}</td>
    case 'lastActivity':
      return (
        <td key={column} className="px-4 py-3 text-sm text-muted-foreground" suppressHydrationWarning>
          {account.lastActivityAt ? formatDate(account.lastActivityAt) : '-'}
        </td>
      )
    case 'hubspot':
      return (
        <td key={column} className="px-4 py-3">
          {account.hubspotCompanyId || account.hubspotContactId ? (
            <Badge variant="success">Synced</Badge>
          ) : (
            <Badge variant="outline">Not synced</Badge>
          )}
        </td>
      )
    case 'health':
      return (
        <td key={column} className="px-4 py-3 text-right">
          <div className="inline-flex flex-col items-end gap-0.5">
            <span className={`text-sm font-bold ${
              account.healthScore >= 70 ? 'text-emerald-600' :
              account.healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {account.healthScore}
            </span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  account.healthScore >= 70 ? 'bg-emerald-500' :
                  account.healthScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${account.healthScore}%` }}
              />
            </div>
          </div>
        </td>
      )
    default:
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">-</td>
  }
}

function AccountStarButton({ account, onStar }: { account: AccountRow; onStar: (id: string, val: boolean) => void }) {
  const [pending, setPending] = useState(false)
  const [, startTransition] = useTransition()

  function handleStar() {
    setPending(true)
    startTransition(async () => {
      try {
        await toggleStarAccount(account.id, !account.starred)
        onStar(account.id, !account.starred)
      } finally {
        setPending(false)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleStar}
      disabled={pending}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-yellow-50 hover:text-yellow-500 disabled:opacity-50"
      aria-label={account.starred ? `Remove ${account.companyName} from starred accounts` : `Star ${account.companyName}`}
    >
      <Star className="h-4 w-4" fill={account.starred ? '#facc15' : 'none'} stroke={account.starred ? '#eab308' : 'currentColor'} />
    </button>
  )
}

function MobileAccountCard({
  account,
  basePath,
  pipelineStages,
  onStar,
  onStageChange,
  onInlineChange,
  regionColors,
  regionOptions,
  salesLeadOptions,
  canAssignSalesLead,
}: {
  account: AccountRow
  basePath: string
  pipelineStages: PipelineStage[]
  onStar: (id: string, val: boolean) => void
  onStageChange: (accountId: string, nextStage: string) => void
  onInlineChange: (accountId: string, update: InlineCRMAccountUpdate) => void
  regionColors: Record<string, string>
  regionOptions: InlineAccountOption[]
  salesLeadOptions: InlineAccountOption[]
  canAssignSalesLead: boolean
}) {
  const pullThroughTone = account.pullThroughScore == null || account.pullThroughScore < 40
    ? 'bg-red-500'
    : account.pullThroughScore < 75 ? 'bg-amber-500' : 'bg-emerald-500'
  const regionColor = account.regionName ? regionColors[account.regionName] : undefined

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`${basePath}/${account.id}`} className="text-base font-bold leading-tight text-slate-950 underline-offset-4 hover:text-[#d94c00] hover:underline">
            {account.companyName}
          </Link>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{[account.address, account.city, account.state].filter(Boolean).join(', ') || 'Address not entered'}</span>
          </p>
        </div>
        <AccountStarButton account={account} onStar={onStar} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <InlineAccountFieldSelect
            accountId={account.id}
            accountName={account.companyName}
            field="businessType"
            value={account.businessType}
            currentLabel={account.businessType ?? 'Unspecified'}
            options={INLINE_BUSINESS_TYPE_OPTIONS}
            toneColor={getBusinessTypeColor(account.businessType)}
            onChange={(update) => onInlineChange(account.id, update)}
          />
          <InlineAccountFieldSelect
            accountId={account.id}
            accountName={account.companyName}
            field="regionId"
            value={account.regionId}
            currentLabel={account.regionName ?? 'Unassigned'}
            options={regionOptions}
            toneColor={regionColor ?? '#94A3B8'}
            onChange={(update) => onInlineChange(account.id, update)}
          />
        </div>
        {account.phone ? <PhoneSmsButton phone={account.phone} recipientName={account.companyName} /> : <span className="text-xs text-slate-400">No phone</span>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f4f1ed] p-3 text-center">
        <div><p className="font-mono text-base font-bold text-slate-950">{account.orderCount ?? 0}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Orders</p></div>
        <div className="border-x border-slate-200"><p className="font-mono text-base font-bold text-slate-950">{account.daysSinceLastOrder == null ? '—' : `${account.daysSinceLastOrder}d`}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Since order</p></div>
        <div><p className="font-mono text-base font-bold text-slate-950">{account.pullThroughScore == null ? '—' : `${account.pullThroughScore}%`}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Pull-through</p></div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${pullThroughTone}`} style={{ width: `${account.pullThroughScore ?? 0}%` }} /></div>

      <div className={`mt-4 grid gap-2 ${canAssignSalesLead ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Terms</p>
          <InlineAccountFieldSelect
            accountId={account.id}
            accountName={account.companyName}
            field="paymentTerms"
            value={account.paymentTerms ?? 'PREPAID'}
            currentLabel={formatPaymentTerms(account.paymentTerms ?? 'PREPAID')}
            options={INLINE_PAYMENT_TERM_OPTIONS}
            className="w-full [&>select]:w-full"
            onChange={(update) => onInlineChange(account.id, update)}
          />
        </div>
        {canAssignSalesLead ? (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sales lead</p>
            <InlineAccountFieldSelect
              accountId={account.id}
              accountName={account.companyName}
              field="salesLeadId"
              value={account.assignedSalesRepId}
              currentLabel={account.salesLeadName ?? 'Unassigned'}
              options={salesLeadOptions}
              className="w-full [&>select]:w-full"
              onChange={(update) => onInlineChange(account.id, update)}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <DealStageSelect accountId={account.id} currentStage={account.dealStage} stages={pipelineStages} size="sm" onStageChange={(nextStage) => onStageChange(account.id, nextStage)} />
        <Button asChild variant="outline" size="sm" className="gap-1.5"><Link href={`${basePath}/${account.id}`}>View <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
      </div>
    </article>
  )
}

function MobileAccountList({
  accounts,
  basePath,
  pipelineStages,
  onStar,
  onStageChange,
  onInlineChange,
  regionColors,
  regionOptions,
  salesLeadOptions,
  canAssignSalesLead,
}: {
  accounts: AccountRow[]
  basePath: string
  pipelineStages: PipelineStage[]
  onStar: (id: string, val: boolean) => void
  onStageChange: (accountId: string, nextStage: string) => void
  onInlineChange: (accountId: string, update: InlineCRMAccountUpdate) => void
  regionColors: Record<string, string>
  regionOptions: InlineAccountOption[]
  salesLeadOptions: InlineAccountOption[]
  canAssignSalesLead: boolean
}) {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {accounts.map((account) => <MobileAccountCard key={account.id} account={account} basePath={basePath} pipelineStages={pipelineStages} onStar={onStar} onStageChange={onStageChange} onInlineChange={onInlineChange} regionColors={regionColors} regionOptions={regionOptions} salesLeadOptions={salesLeadOptions} canAssignSalesLead={canAssignSalesLead} />)}
    </div>
  )
}

function AccountTable({
  accounts,
  onStar,
  onStageChange,
  onInlineChange,
  basePath = '/admin/crm',
  visibleColumns,
  pipelineStages,
  sortBy,
  sortDirection,
  onSort,
  regionColors,
  regionOptions,
  salesLeadOptions,
  canAssignSalesLead,
}: {
  accounts: AccountRow[]
  onStar: (id: string, val: boolean) => void
  onStageChange: (accountId: string, nextStage: string) => void
  onInlineChange: (accountId: string, update: InlineCRMAccountUpdate) => void
  basePath?: string
  visibleColumns: ColumnKey[]
  pipelineStages: PipelineStage[]
  sortBy: SortKey
  sortDirection: SortDirection
  onSort: (column: SortKey) => void
  regionColors: Record<string, string>
  regionOptions: InlineAccountOption[]
  salesLeadOptions: InlineAccountOption[]
  canAssignSalesLead: boolean
}) {
  if (accounts.length === 0) return null

  return (
    <div className="hidden max-h-[calc(100vh-14rem)] overflow-auto md:block">
    <table className="w-full">
      <thead className="sticky top-0 z-10 border-b bg-slate-50">
        <tr>
          <th className="w-8 px-4 py-3" />
          {visibleColumns.map((column) => renderHeaderCell({ column, sortBy, sortDirection, onSort }))}
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {accounts.map((account) => (
          <tr key={account.id} className="transition-colors hover:bg-slate-50">
            <td className="px-4 py-3">
              <AccountStarButton account={account} onStar={onStar} />
            </td>
            {visibleColumns.map((column) => renderAccountCell({ account, column, basePath, pipelineStages, onStageChange, onInlineChange, regionColors, regionOptions, salesLeadOptions, canAssignSalesLead }))}
            <td className="px-4 py-3">
              <Link href={`${basePath}/${account.id}`}>
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

export function LocalAccountsTable({
  initialAccounts,
  basePath = '/admin/crm',
  userId,
  pipelineStages,
  regionColors = {},
  regionOptions = EMPTY_INLINE_ACCOUNT_OPTIONS,
  salesLeadOptions = EMPTY_INLINE_ACCOUNT_OPTIONS,
  canAssignSalesLead = false,
}: {
  initialAccounts: AccountRow[]
  basePath?: string
  userId: string
  pipelineStages: PipelineStage[]
  regionColors?: Record<string, string>
  regionOptions?: InlineAccountOption[]
  salesLeadOptions?: InlineAccountOption[]
  canAssignSalesLead?: boolean
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const isAdminCrm = basePath === '/admin/crm'
  const storageKey = useMemo(() => isAdminCrm ? `crm-columns:v3:${userId}:${basePath}` : `crm-columns:${userId}:${basePath}`, [basePath, isAdminCrm, userId])
  const defaultColumns = isAdminCrm ? ADMIN_DEFAULT_COLUMNS : STANDARD_DEFAULT_COLUMNS
  const filterStorageKey = useMemo(() => `crm-view:${userId}:${basePath}`, [userId, basePath])
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(defaultColumns)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('company')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [activityWindow, setActivityWindow] = useState<ActivityWindowKey>('all')
  const [storageReady, setStorageReady] = useState(false)
  const [page, setPage] = useState(1)
  const inlineRegionOptions = useMemo(() => [{ value: '', label: 'Unassigned' }, ...regionOptions], [regionOptions])
  const inlineSalesLeadOptions = useMemo(() => [{ value: '', label: 'Unassigned' }, ...salesLeadOptions], [salesLeadOptions])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])

  useEffect(() => {
    const storedView = readStoredView(filterStorageKey)
    setSelectedColumns(readStoredColumns(storageKey, defaultColumns))
    setSearchQuery(storedView.searchQuery)
    setSortBy(storedView.sortBy)
    setSortDirection(storedView.sortDirection)
    setActivityWindow(storedView.activityWindow)
    setStorageReady(true)
  }, [defaultColumns, filterStorageKey, storageKey])

  useEffect(() => {
    setPage(1)
  }, [activityWindow, initialAccounts, searchQuery, sortBy, sortDirection])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selectedColumns))
    } catch {}
  }, [selectedColumns, storageKey, storageReady])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(filterStorageKey, JSON.stringify({ searchQuery, sortBy, sortDirection, activityWindow }))
    } catch {}
  }, [activityWindow, filterStorageKey, searchQuery, sortBy, sortDirection, storageReady])

  function handleStar(id: string, val: boolean) {
    setAccounts((prev) => prev.map((account) => account.id === id ? { ...account, starred: val } : account))
  }

  function handleStageChange(accountId: string, nextStage: string) {
    setAccounts((prev) => prev.map((account) => account.id === accountId ? { ...account, dealStage: nextStage } : account))
  }

  function handleInlineChange(accountId: string, update: InlineCRMAccountUpdate) {
    setAccounts((prev) => prev.map((account) => account.id === accountId ? applyInlineAccountUpdate(account, update) : account))
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

  function handleSort(column: SortKey) {
    if (sortBy === column) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection(getDefaultSortDirection(column))
    }
    setPage(1)
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const activityThreshold = getActivityThreshold(activityWindow)
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = !normalizedQuery || [
      account.companyName,
      account.firstName,
      account.lastName,
      account.city,
      account.state,
      account.address,
      account.zip,
      account.phone,
      account.email,
      account.contactName,
      account.businessType,
      account.customerSegment,
      account.customerSource,
      account.paymentTerms,
      account.salesLeadName,
      account.regionName,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
    if (!matchesSearch) return false

    if (!activityThreshold) return true
    const lastActivityAt = normalizeDate(account.lastActivityAt)
    return Boolean(lastActivityAt && lastActivityAt.getTime() >= activityThreshold.getTime())
  })

  const stageOrder = new Map(pipelineStages.map((stage, index) => [stage.stageKey, index]))
  const sortedAccounts = [...filteredAccounts].sort((left, right) => {
    const leftValue = getAccountSortValue(left, sortBy, stageOrder)
    const rightValue = getAccountSortValue(right, sortBy, stageOrder)
    const comparison = compareSortValues(leftValue, rightValue, sortDirection)
    if (comparison !== 0) return comparison
    return left.companyName.localeCompare(right.companyName, undefined, { numeric: true, sensitivity: 'base' })
  })

  const totalPages = Math.max(1, Math.ceil(sortedAccounts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const paginatedAccounts = sortedAccounts.slice(pageStart, pageEnd)
  const starred = paginatedAccounts.filter((account) => account.starred)
  const rest = paginatedAccounts.filter((account) => !account.starred)
  const visibleColumnOptions = selectedColumns
    .map((key) => COLUMN_OPTIONS.find((option) => option.key === key))
    .filter((option): option is (typeof COLUMN_OPTIONS)[number] => Boolean(option))
  const pageNumberStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const safePageStart = Number.isFinite(pageNumberStart) ? pageNumberStart : 1
  const pageNumberEnd = Math.min(totalPages, Math.max(5, safePageStart + 4))
  const pageNumbers = Array.from({ length: pageNumberEnd - safePageStart + 1 }, (_, index) => safePageStart + index)

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Company accounts</p>
          <p className="text-xs text-slate-500">Live CRM and pull-through data.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search accounts"
            className="col-span-2 h-10 w-full rounded-md border border-input bg-white px-3 text-sm sm:h-9 sm:min-w-[220px] sm:w-auto"
          />
          <select
            value={sortBy}
            onChange={(event) => {
              const nextSort = event.target.value as SortKey
              setSortBy(nextSort)
              setSortDirection(getDefaultSortDirection(nextSort))
              setPage(1)
            }}
            className="h-10 min-w-0 rounded-md border border-input bg-white px-2 text-sm sm:h-9 sm:px-3"
            aria-label="Sort accounts"
          >
            {COLUMN_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>Sort: {option.label}</option>
            ))}
          </select>
          <select
            value={activityWindow}
            onChange={(event) => {
              setActivityWindow(event.target.value as ActivityWindowKey)
              setPage(1)
            }}
            className="h-10 min-w-0 rounded-md border border-input bg-white px-2 text-sm sm:h-9 sm:px-3"
          >
            {ACTIVITY_WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="relative col-span-2 sm:col-span-1">
            <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 sm:h-9 sm:w-auto" onClick={() => setShowColumnPicker((prev) => !prev)}>
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
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
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
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(option.key)}
                          onChange={() => toggleColumn(option.key)}
                          className="accent-violet-600"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
        <p>
          {sortedAccounts.length === 0 ? '0 results' : `Showing ${pageStart + 1}-${Math.min(pageEnd, sortedAccounts.length)} of ${sortedAccounts.length}`}
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              Prev
            </Button>
            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === currentPage ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
      {starred.length > 0 ? (
        <div className="border-b">
          <div className="flex items-center gap-2 border-b border-yellow-100 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
            <Star className="h-3.5 w-3.5 fill-yellow-400 stroke-yellow-500" />
            Starred Accounts ({starred.length})
          </div>
          <MobileAccountList accounts={starred} onStar={handleStar} onStageChange={handleStageChange} onInlineChange={handleInlineChange} basePath={basePath} pipelineStages={pipelineStages} regionColors={regionColors} regionOptions={inlineRegionOptions} salesLeadOptions={inlineSalesLeadOptions} canAssignSalesLead={canAssignSalesLead} />
          <AccountTable accounts={starred} onStar={handleStar} onStageChange={handleStageChange} onInlineChange={handleInlineChange} basePath={basePath} visibleColumns={selectedColumns} pipelineStages={pipelineStages} sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} regionColors={regionColors} regionOptions={inlineRegionOptions} salesLeadOptions={inlineSalesLeadOptions} canAssignSalesLead={canAssignSalesLead} />
        </div>
      ) : null}

      {rest.length === 0 && starred.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          No accounts yet. Import from HubSpot or add manually.
        </div>
      ) : rest.length > 0 ? (
        <>
          <MobileAccountList accounts={rest} onStar={handleStar} onStageChange={handleStageChange} onInlineChange={handleInlineChange} basePath={basePath} pipelineStages={pipelineStages} regionColors={regionColors} regionOptions={inlineRegionOptions} salesLeadOptions={inlineSalesLeadOptions} canAssignSalesLead={canAssignSalesLead} />
          <AccountTable accounts={rest} onStar={handleStar} onStageChange={handleStageChange} onInlineChange={handleInlineChange} basePath={basePath} visibleColumns={selectedColumns} pipelineStages={pipelineStages} sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} regionColors={regionColors} regionOptions={inlineRegionOptions} salesLeadOptions={inlineSalesLeadOptions} canAssignSalesLead={canAssignSalesLead} />
        </>
      ) : null}
      {sortedAccounts.length > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <p>Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              Prev
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
