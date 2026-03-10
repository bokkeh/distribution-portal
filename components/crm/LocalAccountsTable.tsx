'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, Star } from 'lucide-react'
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

function AccountTable({
  accounts,
  onStar,
}: {
  accounts: AccountRow[]
  onStar: (id: string, val: boolean) => void
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
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th>
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</th>
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Terms</th>
          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Cases</th>
          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Purchased</th>
          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</th>
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">HubSpot</th>
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
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{account.companyName}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {[account.city, account.state].filter(Boolean).join(', ') || '-'}
            </td>
            <td className="px-4 py-3 text-sm">
              {account.phone ? (
                <PhoneSmsButton phone={account.phone} recipientName={account.companyName} />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </td>
            <td className="px-4 py-3">
              <Badge variant="secondary">{account.paymentTerms ?? 'NET30'}</Badge>
            </td>
            <td className="px-4 py-3 text-right text-sm font-medium">
              {account.pendingCases > 0 ? (
                <span className="text-amber-600">{account.pendingCases.toLocaleString()}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </td>
            <td className="px-4 py-3 text-right text-sm font-medium">
              {account.totalCasesPurchased > 0 ? account.totalCasesPurchased.toLocaleString() : '-'}
            </td>
            <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(account.balance ?? '0')}</td>
            <td className="px-4 py-3">
              {account.hubspotCompanyId || account.hubspotContactId ? (
                <Badge variant="success">Synced</Badge>
              ) : (
                <Badge variant="outline">Not synced</Badge>
              )}
            </td>
            <td className="px-4 py-3">
              <Link href={`/admin/crm/${account.id}`}>
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function LocalAccountsTable({ initialAccounts }: { initialAccounts: AccountRow[] }) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts)

  function handleStar(id: string, val: boolean) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, starred: val } : a))
  }

  const starred = accounts.filter(a => a.starred)
  const rest = accounts.filter(a => !a.starred)

  return (
    <div className="overflow-x-auto">
      {starred.length > 0 ? (
        <div className="border-b">
          <div className="flex items-center gap-2 border-b border-yellow-100 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
            <Star className="h-3.5 w-3.5 fill-yellow-400 stroke-yellow-500" />
            Starred Accounts ({starred.length})
          </div>
          <AccountTable accounts={starred} onStar={handleStar} />
        </div>
      ) : null}

      {rest.length === 0 && starred.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          No accounts yet. Import from HubSpot or add manually.
        </div>
      ) : rest.length > 0 ? (
        <AccountTable accounts={rest} onStar={handleStar} />
      ) : null}
    </div>
  )
}
