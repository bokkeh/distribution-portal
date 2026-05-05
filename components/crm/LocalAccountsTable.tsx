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
import { Building2, GripVertical, Settings2, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toggleStarAccount } from '@/actions/crm'
import { getCustomerSegmentLabel, getCustomerSourceLabel } from '@/lib/customers/account-segmentation'
import { formatCurrency } from '@/lib/utils'
import type { PipelineStage } from '@/lib/deal-stages'
import { PhoneSmsButton } from './PhoneSmsButton'
import { DealStageSelect } from './DealStageSelect'

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
}

const COLUMN_OPTIONS = [
  { key: 'company', label: 'Company' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'location', label: 'City / State' },
  { key: 'address', label: 'Street Address' },
  { key: 'zip', label: 'Zip Code' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'contactName', label: 'Primary Contact' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'segment', label: 'Segment' },
  { key: 'source', label: 'Source' },
  { key: 'dealStage', label: 'Deal Stage' },
  { key: 'salesLead', label: 'Sales Lead' },
  { key: 'terms', label: 'Terms' },
  { key: 'creditLimit', label: 'Credit Limit' },
  { key: 'pendingCases', label: 'Pending Cases' },
  { key: 'totalPurchased', label: 'Total Purchased' },
  { key: 'balance', label: 'Balance' },
  { key: 'hubspot', label: 'HubSpot' },
  { key: 'health', label: 'Health Score' },
] as const

type ColumnKey = (typeof COLUMN_OPTIONS)[number]['key']

const DEFAULT_COLUMNS: ColumnKey[] = ['company', 'segment', 'location', 'phone', 'dealStage', 'terms', 'pendingCases', 'totalPurchased', 'balance', 'health', 'hubspot']
const NUMERIC_COLUMNS = new Set<ColumnKey>(['creditLimit', 'pendingCases', 'totalPurchased', 'balance', 'health'])

function readStoredColumns(storageKey: string): ColumnKey[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return DEFAULT_COLUMNS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS
    const next = parsed.filter((value): value is ColumnKey =>
      COLUMN_OPTIONS.some((option) => option.key === value)
    )
    return next.length ? next : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}

function readStoredView(filterStorageKey: string): {
  searchQuery: string
  sortBy: 'company' | 'balance' | 'pendingCases' | 'health'
} {
  if (typeof window === 'undefined') {
    return { searchQuery: '', sortBy: 'company' }
  }

  try {
    const raw = window.localStorage.getItem(filterStorageKey)
    if (!raw) return { searchQuery: '', sortBy: 'company' }
    const parsed = JSON.parse(raw) as { searchQuery?: string; sortBy?: 'company' | 'balance' | 'pendingCases' | 'health' }
    return {
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
      sortBy: parsed.sortBy === 'balance' || parsed.sortBy === 'pendingCases' || parsed.sortBy === 'health' ? parsed.sortBy : 'company',
    }
  } catch {
    return { searchQuery: '', sortBy: 'company' }
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

function renderHeaderCell(column: ColumnKey) {
  const option = COLUMN_OPTIONS.find((item) => item.key === column)
  const alignment = NUMERIC_COLUMNS.has(column) ? 'text-right' : 'text-left'

  return (
    <th key={column} className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground ${alignment}`}>
      {option?.label ?? column}
    </th>
  )
}

function renderAccountCell({
  account,
  column,
  pipelineStages,
  onStageChange,
}: {
  account: AccountRow
  column: ColumnKey
  pipelineStages: PipelineStage[]
  onStageChange: (accountId: string, nextStage: string) => void
}) {
  switch (column) {
    case 'company':
      return (
        <td key={column} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">{account.companyName}</span>
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
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.businessType ?? '-'}</td>
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
      return <td key={column} className="px-4 py-3 text-sm text-muted-foreground">{account.salesLeadName ?? '-'}</td>
    case 'terms':
      return (
        <td key={column} className="px-4 py-3">
          <Badge variant="secondary">{account.paymentTerms ?? 'PREPAID'}</Badge>
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

function AccountTable({
  accounts,
  onStar,
  onStageChange,
  basePath = '/admin/crm',
  visibleColumns,
  pipelineStages,
}: {
  accounts: AccountRow[]
  onStar: (id: string, val: boolean) => void
  onStageChange: (accountId: string, nextStage: string) => void
  basePath?: string
  visibleColumns: ColumnKey[]
  pipelineStages: PipelineStage[]
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleStar(id: string, current: boolean) {
    setPending(id)
    startTransition(async () => {
      await toggleStarAccount(id, !current)
      onStar(id, !current)
      setPending(null)
    })
  }

  if (accounts.length === 0) return null

  return (
    <table className="w-full">
      <thead className="border-b bg-slate-50">
        <tr>
          <th className="w-8 px-4 py-3" />
          {visibleColumns.map((column) => renderHeaderCell(column))}
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {accounts.map((account) => (
          <tr key={account.id} className="transition-colors hover:bg-slate-50">
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => handleStar(account.id, account.starred)}
                disabled={pending === account.id}
                className="text-muted-foreground transition-colors hover:text-yellow-400 disabled:opacity-50"
              >
                <Star
                  className="h-4 w-4"
                  fill={account.starred ? '#facc15' : 'none'}
                  stroke={account.starred ? '#eab308' : 'currentColor'}
                />
              </button>
            </td>
            {visibleColumns.map((column) => renderAccountCell({ account, column, pipelineStages, onStageChange }))}
            <td className="px-4 py-3">
              <Link href={`${basePath}/${account.id}`}>
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function LocalAccountsTable({
  initialAccounts,
  basePath = '/admin/crm',
  userId,
  pipelineStages,
}: {
  initialAccounts: AccountRow[]
  basePath?: string
  userId: string
  pipelineStages: PipelineStage[]
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const storageKey = useMemo(() => `crm-columns:${userId}:${basePath}`, [userId, basePath])
  const filterStorageKey = useMemo(() => `crm-view:${userId}:${basePath}`, [userId, basePath])
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(() => readStoredColumns(storageKey))
  const [searchQuery, setSearchQuery] = useState(() => readStoredView(filterStorageKey).searchQuery)
  const [sortBy, setSortBy] = useState<'company' | 'balance' | 'pendingCases' | 'health'>(() => readStoredView(filterStorageKey).sortBy)
  const [page, setPage] = useState(1)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])

  useEffect(() => {
    setPage(1)
  }, [initialAccounts, searchQuery, sortBy])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selectedColumns))
    } catch {}
  }, [storageKey, selectedColumns])

  useEffect(() => {
    try {
      window.localStorage.setItem(filterStorageKey, JSON.stringify({ searchQuery, sortBy }))
    } catch {}
  }, [filterStorageKey, searchQuery, sortBy])

  function handleStar(id: string, val: boolean) {
    setAccounts((prev) => prev.map((account) => account.id === id ? { ...account, starred: val } : account))
  }

  function handleStageChange(accountId: string, nextStage: string) {
    setAccounts((prev) => prev.map((account) => account.id === accountId ? { ...account, dealStage: nextStage } : account))
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

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredAccounts = accounts.filter((account) => {
    if (!normalizedQuery) return true
    return [
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
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
  })

  const sortedAccounts = [...filteredAccounts].sort((left, right) => {
    if (sortBy === 'balance') return Number(right.balance ?? 0) - Number(left.balance ?? 0)
    if (sortBy === 'pendingCases') return right.pendingCases - left.pendingCases
    if (sortBy === 'health') return right.healthScore - left.healthScore
    return left.companyName.localeCompare(right.companyName)
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
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Visible Columns</p>
          <p className="text-xs text-slate-500">Saved to your login only.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search accounts"
            className="h-9 min-w-[220px] rounded-md border border-input bg-white px-3 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as typeof sortBy)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="company">Sort: Company</option>
            <option value="balance">Sort: Balance</option>
            <option value="pendingCases">Sort: Pending Cases</option>
            <option value="health">Sort: Health Score</option>
          </select>
          <div className="relative">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowColumnPicker((prev) => !prev)}>
              <Settings2 className="h-4 w-4" />
              Customize Columns
            </Button>
            {showColumnPicker ? (
              <div className="absolute right-0 z-10 mt-2 w-[340px] rounded-xl border border-slate-200 bg-white shadow-lg">
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
          <AccountTable accounts={starred} onStar={handleStar} onStageChange={handleStageChange} basePath={basePath} visibleColumns={selectedColumns} pipelineStages={pipelineStages} />
        </div>
      ) : null}

      {rest.length === 0 && starred.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          No accounts yet. Import from HubSpot or add manually.
        </div>
      ) : rest.length > 0 ? (
        <AccountTable accounts={rest} onStar={handleStar} onStageChange={handleStageChange} basePath={basePath} visibleColumns={selectedColumns} pipelineStages={pipelineStages} />
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
