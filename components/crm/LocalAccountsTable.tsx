'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, Settings2, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toggleStarAccount } from '@/actions/crm'
import { formatCurrency } from '@/lib/utils'
import { PhoneSmsButton } from './PhoneSmsButton'

export interface AccountRow {
  id: string
  companyName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  email: string | null
  phone: string | null
  contactName: string | null
  businessType: string | null
  dealStage: string | null
  creditLimit: string
  balance: string
  paymentTerms: string | null
  hubspotContactId: string | null
  hubspotCompanyId: string | null
  starred: boolean
  pendingCases: number
  totalCasesPurchased: number
  healthScore: number
}

const COLUMN_OPTIONS = [
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'City / State' },
  { key: 'address', label: 'Street Address' },
  { key: 'zip', label: 'Zip Code' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'contactName', label: 'Primary Contact' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'dealStage', label: 'Deal Stage' },
  { key: 'terms', label: 'Terms' },
  { key: 'creditLimit', label: 'Credit Limit' },
  { key: 'pendingCases', label: 'Pending Cases' },
  { key: 'totalPurchased', label: 'Total Purchased' },
  { key: 'balance', label: 'Balance' },
  { key: 'hubspot', label: 'HubSpot' },
  { key: 'health', label: 'Health Score' },
] as const

type ColumnKey = (typeof COLUMN_OPTIONS)[number]['key']

const DEFAULT_COLUMNS: ColumnKey[] = ['company', 'location', 'phone', 'terms', 'pendingCases', 'totalPurchased', 'balance', 'health', 'hubspot']

function AccountTable({
  accounts,
  onStar,
  basePath = '/admin/crm',
  visibleColumns,
}: {
  accounts: AccountRow[]
  onStar: (id: string, val: boolean) => void
  basePath?: string
  visibleColumns: Set<ColumnKey>
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
          {visibleColumns.has('company') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th>}
          {visibleColumns.has('location') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</th>}
          {visibleColumns.has('address') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</th>}
          {visibleColumns.has('zip') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Zip</th>}
          {visibleColumns.has('phone') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>}
          {visibleColumns.has('email') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>}
          {visibleColumns.has('contactName') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary Contact</th>}
          {visibleColumns.has('businessType') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Business Type</th>}
          {visibleColumns.has('dealStage') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Deal Stage</th>}
          {visibleColumns.has('terms') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Terms</th>}
          {visibleColumns.has('creditLimit') && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit Limit</th>}
          {visibleColumns.has('pendingCases') && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Cases</th>}
          {visibleColumns.has('totalPurchased') && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Purchased</th>}
          {visibleColumns.has('balance') && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</th>}
          {visibleColumns.has('hubspot') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">HubSpot</th>}
          {visibleColumns.has('health') && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Health</th>}
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {accounts.map(account => (
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
            {visibleColumns.has('company') && (
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{account.companyName}</span>
                </div>
              </td>
            )}
            {visibleColumns.has('location') && (
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {[account.city, account.state].filter(Boolean).join(', ') || '-'}
              </td>
            )}
            {visibleColumns.has('address') && (
              <td className="px-4 py-3 text-sm text-muted-foreground">{account.address ?? '-'}</td>
            )}
            {visibleColumns.has('zip') && (
              <td className="px-4 py-3 text-sm text-muted-foreground">{account.zip ?? '-'}</td>
            )}
            {visibleColumns.has('phone') && (
              <td className="px-4 py-3 text-sm">
                {account.phone ? (
                  <PhoneSmsButton phone={account.phone} recipientName={account.companyName} />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            )}
            {visibleColumns.has('email') && (
              <td className="px-4 py-3 text-sm text-muted-foreground">{account.email ?? '-'}</td>
            )}
            {visibleColumns.has('contactName') && (
              <td className="px-4 py-3 text-sm text-muted-foreground">{account.contactName ?? '-'}</td>
            )}
            {visibleColumns.has('businessType') && (
              <td className="px-4 py-3 text-sm text-muted-foreground">{account.businessType ?? '-'}</td>
            )}
            {visibleColumns.has('dealStage') && (
              <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{account.dealStage?.replace(/_/g, ' ') ?? '-'}</td>
            )}
            {visibleColumns.has('terms') && (
              <td className="px-4 py-3">
                <Badge variant="secondary">{account.paymentTerms ?? 'NET30'}</Badge>
              </td>
            )}
            {visibleColumns.has('creditLimit') && (
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(account.creditLimit ?? '0')}</td>
            )}
            {visibleColumns.has('pendingCases') && (
              <td className="px-4 py-3 text-right text-sm font-medium">
                {account.pendingCases > 0 ? (
                  <span className="text-amber-600">{account.pendingCases.toLocaleString()}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            )}
            {visibleColumns.has('totalPurchased') && (
              <td className="px-4 py-3 text-right text-sm font-medium">
                {account.totalCasesPurchased > 0 ? account.totalCasesPurchased.toLocaleString() : '-'}
              </td>
            )}
            {visibleColumns.has('balance') && (
              <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(account.balance ?? '0')}</td>
            )}
            {visibleColumns.has('hubspot') && (
              <td className="px-4 py-3">
                {account.hubspotCompanyId || account.hubspotContactId ? (
                  <Badge variant="success">Synced</Badge>
                ) : (
                  <Badge variant="outline">Not synced</Badge>
                )}
              </td>
            )}
            {visibleColumns.has('health') && (
              <td className="px-4 py-3 text-right">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <span className={`text-sm font-bold ${
                    account.healthScore >= 70 ? 'text-emerald-600' :
                    account.healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {account.healthScore}
                  </span>
                  <div className="h-1 w-12 rounded-full bg-slate-100 overflow-hidden">
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
            )}
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
}: {
  initialAccounts: AccountRow[]
  basePath?: string
  userId: string
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const storageKey = useMemo(() => `crm-columns:${userId}:${basePath}`, [userId, basePath])
  const filterStorageKey = useMemo(() => `crm-view:${userId}:${basePath}`, [userId, basePath])
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'company' | 'balance' | 'pendingCases' | 'health'>('company')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const next = parsed.filter((value): value is ColumnKey =>
        COLUMN_OPTIONS.some(option => option.key === value)
      )
      if (next.length) setSelectedColumns(next)
    } catch {}
  }, [storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selectedColumns))
    } catch {}
  }, [storageKey, selectedColumns])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(filterStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { searchQuery?: string; sortBy?: 'company' | 'balance' | 'pendingCases' | 'health' }
      if (typeof parsed.searchQuery === 'string') setSearchQuery(parsed.searchQuery)
      if (parsed.sortBy === 'company' || parsed.sortBy === 'balance' || parsed.sortBy === 'pendingCases' || parsed.sortBy === 'health') {
        setSortBy(parsed.sortBy)
      }
    } catch {}
  }, [filterStorageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(filterStorageKey, JSON.stringify({ searchQuery, sortBy }))
    } catch {}
  }, [filterStorageKey, searchQuery, sortBy])

  function handleStar(id: string, val: boolean) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, starred: val } : a))
  }

  function toggleColumn(column: ColumnKey) {
    setSelectedColumns(prev => {
      if (prev.includes(column)) {
        if (prev.length === 1) return prev
        return prev.filter(value => value !== column)
      }
      const ordered = COLUMN_OPTIONS.map(option => option.key)
      return ordered.filter(value => [...prev, column].includes(value))
    })
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredAccounts = accounts.filter(account => {
    if (!normalizedQuery) return true
    return [
      account.companyName,
      account.city,
      account.state,
      account.address,
      account.zip,
      account.phone,
      account.email,
      account.contactName,
      account.businessType,
      account.paymentTerms,
    ].some(value => String(value ?? '').toLowerCase().includes(normalizedQuery))
  })

  const sortedAccounts = [...filteredAccounts].sort((left, right) => {
    if (sortBy === 'balance') return Number(right.balance ?? 0) - Number(left.balance ?? 0)
    if (sortBy === 'pendingCases') return right.pendingCases - left.pendingCases
    if (sortBy === 'health') return right.healthScore - left.healthScore
    return left.companyName.localeCompare(right.companyName)
  })

  const starred = sortedAccounts.filter(a => a.starred)
  const rest = sortedAccounts.filter(a => !a.starred)
  const visibleColumns = new Set(selectedColumns)

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
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search accounts"
            className="h-9 min-w-[220px] rounded-md border border-input bg-white px-3 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="company">Sort: Company</option>
            <option value="balance">Sort: Balance</option>
            <option value="pendingCases">Sort: Pending Cases</option>
            <option value="health">Sort: Health Score</option>
          </select>
          <div className="relative">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowColumnPicker(prev => !prev)}>
              <Settings2 className="h-4 w-4" />
              Customize Columns
            </Button>
            {showColumnPicker && (
              <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">Show / Hide Columns</p>
                  <button type="button" onClick={() => setShowColumnPicker(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-3 space-y-1.5">
                  {COLUMN_OPTIONS.map(option => (
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
            )}
          </div>
        </div>
      </div>
      {starred.length > 0 && (
        <div className="border-b">
          <div className="flex items-center gap-2 border-b border-yellow-100 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
            <Star className="h-3.5 w-3.5 fill-yellow-400 stroke-yellow-500" />
            Starred Accounts ({starred.length})
          </div>
          <AccountTable accounts={starred} onStar={handleStar} basePath={basePath} visibleColumns={visibleColumns} />
        </div>
      )}

      {rest.length === 0 && starred.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          No accounts yet. Import from HubSpot or add manually.
        </div>
      ) : rest.length > 0 ? (
        <AccountTable accounts={rest} onStar={handleStar} basePath={basePath} visibleColumns={visibleColumns} />
      ) : null}
    </div>
  )
}
