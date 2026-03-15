'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, Settings2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toggleStarAccount } from '@/actions/crm'
import { formatCurrency } from '@/lib/utils'
import { PhoneSmsButton } from './PhoneSmsButton'

export interface AccountRow {
  id: string
  companyName: string
  city: string | null
  state: string | null
  email: string | null
  phone: string | null
  creditLimit: string
  balance: string
  paymentTerms: string | null
  hubspotContactId: string | null
  hubspotCompanyId: string | null
  starred: boolean
  pendingCases: number
  totalCasesPurchased: number
}

const COLUMN_OPTIONS = [
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'Location' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'terms', label: 'Terms' },
  { key: 'pendingCases', label: 'Pending Cases' },
  { key: 'totalPurchased', label: 'Total Purchased' },
  { key: 'balance', label: 'Balance' },
  { key: 'hubspot', label: 'HubSpot' },
] as const

type ColumnKey = (typeof COLUMN_OPTIONS)[number]['key']

const DEFAULT_COLUMNS: ColumnKey[] = ['company', 'location', 'phone', 'terms', 'pendingCases', 'totalPurchased', 'balance', 'hubspot']

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
          {visibleColumns.has('company') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th> : null}
          {visibleColumns.has('location') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</th> : null}
          {visibleColumns.has('phone') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th> : null}
          {visibleColumns.has('email') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th> : null}
          {visibleColumns.has('terms') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Terms</th> : null}
          {visibleColumns.has('pendingCases') ? <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Cases</th> : null}
          {visibleColumns.has('totalPurchased') ? <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Purchased</th> : null}
          {visibleColumns.has('balance') ? <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</th> : null}
          {visibleColumns.has('hubspot') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">HubSpot</th> : null}
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
            {visibleColumns.has('company') ? (
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{account.companyName}</span>
                </div>
              </td>
            ) : null}
            {visibleColumns.has('location') ? (
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {[account.city, account.state].filter(Boolean).join(', ') || '-'}
              </td>
            ) : null}
            {visibleColumns.has('phone') ? (
              <td className="px-4 py-3 text-sm">
                {account.phone ? (
                  <PhoneSmsButton phone={account.phone} recipientName={account.companyName} />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            ) : null}
            {visibleColumns.has('email') ? (
              <td className="px-4 py-3 text-sm text-muted-foreground">{account.email ?? '-'}</td>
            ) : null}
            {visibleColumns.has('terms') ? (
              <td className="px-4 py-3">
                <Badge variant="secondary">{account.paymentTerms ?? 'NET30'}</Badge>
              </td>
            ) : null}
            {visibleColumns.has('pendingCases') ? (
              <td className="px-4 py-3 text-right text-sm font-medium">
                {account.pendingCases > 0 ? (
                  <span className="text-amber-600">{account.pendingCases.toLocaleString()}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            ) : null}
            {visibleColumns.has('totalPurchased') ? (
              <td className="px-4 py-3 text-right text-sm font-medium">
                {account.totalCasesPurchased > 0 ? account.totalCasesPurchased.toLocaleString() : '-'}
              </td>
            ) : null}
            {visibleColumns.has('balance') ? (
              <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(account.balance ?? '0')}</td>
            ) : null}
            {visibleColumns.has('hubspot') ? (
              <td className="px-4 py-3">
                {account.hubspotCompanyId || account.hubspotContactId ? (
                  <Badge variant="success">Synced</Badge>
                ) : (
                  <Badge variant="outline">Not synced</Badge>
                )}
              </td>
            ) : null}
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
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)

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

  const starred = accounts.filter(a => a.starred)
  const rest = accounts.filter(a => !a.starred)
  const visibleColumns = new Set(selectedColumns)

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Visible Columns</p>
          <p className="text-xs text-slate-500">Saved to your login only.</p>
        </div>
        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowColumnPicker(prev => !prev)}>
            <Settings2 className="h-4 w-4" />
            Customize Columns
          </Button>
          {showColumnPicker ? (
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="space-y-2">
                {COLUMN_OPTIONS.map(option => (
                  <label key={option.key} className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(option.key)}
                      onChange={() => toggleColumn(option.key)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {starred.length > 0 ? (
        <div className="border-b">
          <div className="flex items-center gap-2 border-b border-yellow-100 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
            <Star className="h-3.5 w-3.5 fill-yellow-400 stroke-yellow-500" />
            Starred Accounts ({starred.length})
          </div>
          <AccountTable accounts={starred} onStar={handleStar} basePath={basePath} visibleColumns={visibleColumns} />
        </div>
      ) : null}

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
