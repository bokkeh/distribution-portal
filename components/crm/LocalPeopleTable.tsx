'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhoneSmsButton } from './PhoneSmsButton'

export interface PersonRow {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  phoneType: string | null
  preferredContact: string | null
  isPrimary: boolean
  companyName: string
  customerId: string
}

const COLUMN_OPTIONS = [
  { key: 'person', label: 'Person' },
  { key: 'title', label: 'Title' },
  { key: 'company', label: 'Company' },
  { key: 'phone', label: 'Phone' },
  { key: 'phoneType', label: 'Phone Type' },
  { key: 'email', label: 'Email' },
  { key: 'preferredContact', label: 'Preferred Contact' },
  { key: 'isPrimary', label: 'Primary Contact' },
] as const

type ColumnKey = (typeof COLUMN_OPTIONS)[number]['key']

const DEFAULT_COLUMNS: ColumnKey[] = ['person', 'title', 'company', 'phone', 'email', 'preferredContact']
const STORAGE_KEY = 'crm-people-columns'

export function LocalPeopleTable({
  people,
  basePath,
}: {
  people: PersonRow[]
  basePath: '/admin/crm' | '/staff/crm'
}) {
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const next = parsed.filter((v): v is ColumnKey => COLUMN_OPTIONS.some(o => o.key === v))
      if (next.length) setSelectedColumns(next)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns))
    } catch {}
  }, [selectedColumns])

  function toggleColumn(column: ColumnKey) {
    setSelectedColumns(prev => {
      if (prev.includes(column)) {
        if (prev.length === 1) return prev
        return prev.filter(v => v !== column)
      }
      const ordered = COLUMN_OPTIONS.map(o => o.key)
      return ordered.filter(v => [...prev, column].includes(v))
    })
  }

  const vis = new Set(selectedColumns)

  if (people.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No CRM contacts yet. Add contacts to accounts to build your people view.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">People</p>
          <p className="text-xs text-slate-500">{people.length} contact{people.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowColumnPicker(prev => !prev)}>
            <Settings2 className="h-4 w-4" />
            Customize Columns
          </Button>
          {showColumnPicker && (
            <div className="absolute right-0 z-10 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg">
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

      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            {vis.has('person') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Person</th>}
            {vis.has('title') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th>}
            {vis.has('company') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th>}
            {vis.has('phone') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>}
            {vis.has('phoneType') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone Type</th>}
            {vis.has('email') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>}
            {vis.has('preferredContact') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferred</th>}
            {vis.has('isPrimary') && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</th>}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {people.map((person) => (
            <tr key={person.id} className="transition-colors hover:bg-slate-50">
              {vis.has('person') && (
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{person.name}</p>
                </td>
              )}
              {vis.has('title') && (
                <td className="px-4 py-3 text-sm text-muted-foreground">{person.title ?? '-'}</td>
              )}
              {vis.has('company') && (
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{person.companyName}</td>
              )}
              {vis.has('phone') && (
                <td className="px-4 py-3 text-sm">
                  {person.phone ? (
                    <PhoneSmsButton phone={person.phone} recipientName={person.name} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              )}
              {vis.has('phoneType') && (
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{person.phoneType ?? '-'}</td>
              )}
              {vis.has('email') && (
                <td className="px-4 py-3 text-sm text-muted-foreground">{person.email ?? '-'}</td>
              )}
              {vis.has('preferredContact') && (
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {person.preferredContact ? person.preferredContact.toUpperCase() : '-'}
                </td>
              )}
              {vis.has('isPrimary') && (
                <td className="px-4 py-3">
                  {person.isPrimary ? <Badge variant="success">Primary</Badge> : <span className="text-xs text-muted-foreground">-</span>}
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Link href={`${basePath}/${person.customerId}`}>
                    <Button variant="ghost" size="sm">View Account</Button>
                  </Link>
                  <Link href={`${basePath}/${person.customerId}/contacts`}>
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
