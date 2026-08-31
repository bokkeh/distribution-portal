'use client'

import { useDeferredValue, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PhoneSmsButton } from './PhoneSmsButton'

export type CommunityContactRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status: 'subscribed' | 'unsubscribed'
  source: 'public_signup' | 'admin_entry' | 'import'
  createdAt: Date | string
}

const sourceLabels: Record<CommunityContactRow['source'], string> = {
  public_signup: 'Signup link',
  admin_entry: 'Admin entry',
  import: 'Import',
}

export function CommunityContactsTable({ contacts }: { contacts: CommunityContactRow[] }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const filtered = deferredQuery
    ? contacts.filter((contact) =>
        [contact.firstName, contact.lastName, contact.email, contact.phone]
          .some((value) => value.toLowerCase().includes(deferredQuery)),
      )
    : contacts

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">Community contacts</p>
          <p className="text-xs text-slate-500">{filtered.length} of {contacts.length} newsletter members</p>
        </div>
        <label className="relative">
          <span className="sr-only">Search community contacts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search community contacts"
            className="h-9 min-w-64 rounded-md border border-input bg-white pl-9 pr-3 text-sm"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b bg-[#f4f1ed]">
            <tr className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-600">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((contact) => (
              <tr key={contact.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900"><Link href={`/admin/crm/community/${contact.id}`} className="decoration-[#ff5a00] underline-offset-4 hover:text-[#ff5a00] hover:underline">{contact.firstName} {contact.lastName}</Link></td>
                <td className="px-4 py-3 text-sm text-slate-600"><a href={`mailto:${contact.email}`} className="hover:text-[#ff5a00] hover:underline">{contact.email}</a></td>
                <td className="px-4 py-3"><PhoneSmsButton phone={contact.phone} recipientName={`${contact.firstName} ${contact.lastName}`} /></td>
                <td className="px-4 py-3 text-sm text-slate-600">{sourceLabels[contact.source]}</td>
                <td className="px-4 py-3"><Badge variant={contact.status === 'subscribed' ? 'success' : 'outline'}>{contact.status}</Badge></td>
                <td className="px-4 py-3 text-sm text-slate-500">{new Date(contact.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">No community contacts match this search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
