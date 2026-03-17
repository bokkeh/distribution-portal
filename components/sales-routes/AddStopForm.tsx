'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { addSalesRouteStop, addManualSalesRouteStop } from '@/actions/sales-routes'
import Link from 'next/link'

type Account = {
  id: string
  companyName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export default function AddSalesRouteStopForm({
  routeId,
  accounts,
  error,
}: {
  routeId: string
  accounts: Account[]
  error?: string
}) {
  const [tab, setTab] = useState<'account' | 'manual'>('account')

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('account')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'account'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Select Account
        </button>
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'manual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Manual Address
        </button>
      </div>

      {tab === 'account' ? (
        <form action={addSalesRouteStop.bind(null, routeId)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="customerId" className="text-sm font-medium text-slate-900">
              Account
            </label>
            <select
              id="customerId"
              name="customerId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.companyName}
                  {account.address
                    ? ` — ${[account.address, account.city, account.state, account.zip].filter(Boolean).join(', ')}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="account-stop-notes" className="text-sm font-medium text-slate-900">
              Stop Notes
            </label>
            <textarea
              id="account-stop-notes"
              name="notes"
              rows={3}
              placeholder="Parking details, best contact time, buyer preferences, or visit reminders."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit">Add Stop</Button>
            <Link href={`/admin/crm/sales-routes/${routeId}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      ) : (
        <form action={addManualSalesRouteStop.bind(null, routeId)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium text-slate-900">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              id="address"
              name="address"
              type="text"
              required
              placeholder="123 Main St, Houston, TX 77001"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="contactName" className="text-sm font-medium text-slate-900">
                Contact Name
              </label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                placeholder="John Smith"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="contactPhone" className="text-sm font-medium text-slate-900">
                Contact Phone
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                placeholder="(713) 555-0100"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="manual-stop-notes" className="text-sm font-medium text-slate-900">
              Stop Notes
            </label>
            <textarea
              id="manual-stop-notes"
              name="notes"
              rows={3}
              placeholder="Gate code, parking instructions, contact preferences, or sales context."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit">Add Stop</Button>
            <Link href={`/admin/crm/sales-routes/${routeId}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
