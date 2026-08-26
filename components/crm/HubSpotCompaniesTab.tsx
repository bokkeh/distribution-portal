'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, Download, Globe, Pencil, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { importHubSpotCompany, updateHubSpotCompanyAction } from '@/actions/crm'
import type { HubSpotCompany } from '@/lib/hubspot/client'
import { PhoneSmsButton } from './PhoneSmsButton'

const MONTGOMERY_COUNTY_CITIES = new Set([
  'rockville', 'gaithersburg', 'silver spring', 'bethesda', 'germantown',
  'potomac', 'wheaton', 'kensington', 'chevy chase', 'olney', 'clarksburg',
  'damascus', 'aspen hill', 'north bethesda', 'montgomery village', 'burtonsville',
  'laytonsville', 'brookeville', 'poolesville', 'takoma park',
])

type Filter = 'all' | 'montgomery' | 'maryland' | 'dc'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'montgomery', label: 'Montgomery County' },
  { id: 'maryland', label: 'Maryland' },
  { id: 'dc', label: 'DC' },
]

interface Props {
  companies: HubSpotCompany[]
  importedIds: Set<string>
  localAccountIds: Map<string, string>
  error?: string
}

function EditModal({
  company,
  localAccountId,
  onClose,
  onSaved,
}: {
  company: HubSpotCompany
  localAccountId: string | null
  onClose: () => void
  onSaved: (updated: HubSpotCompany) => void
}) {
  const [form, setForm] = useState({
    name: company.name,
    phone: company.phone ?? '',
    address: company.address ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    zip: company.zip ?? '',
    website: company.website ?? '',
    industry: company.industry ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    setSaving(true)
    setError(null)
    startTransition(async () => {
      const result = await updateHubSpotCompanyAction(company.id, localAccountId, form)
      if ('error' in result) {
        setError(String(result.error))
      } else {
        onSaved({
          ...company,
          ...form,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          website: form.website || null,
          industry: form.industry || null,
        })
        onClose()
      }
      setSaving(false)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Company</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Company Name</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Industry</Label>
            <Input value={form.industry} onChange={e => set('industry', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>City</Label>
            <Input value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>State</Label>
            <Input value={form.state} onChange={e => set('state', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Zip</Label>
            <Input value={form.zip} onChange={e => set('zip', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Website</Label>
            <Input value={form.website} onChange={e => set('website', e.target.value)} />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Sync to HubSpot'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function HubSpotCompaniesTab({ companies: initialCompanies, importedIds, localAccountIds, error }: Props) {
  const [companies, setCompanies] = useState<HubSpotCompany[]>(initialCompanies)
  const [imported, setImported] = useState<Set<string>>(new Set(importedIds))
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<HubSpotCompany | null>(null)
  const [, startTransition] = useTransition()

  function handleImport(id: string) {
    setPendingImport(id)
    startTransition(async () => {
      const result = await importHubSpotCompany(id)
      if (!('error' in result)) {
        setImported(prev => new Set([...prev, id]))
      }
      setPendingImport(null)
    })
  }

  const filtered = useMemo(() => {
    let list = companies

    if (filter === 'montgomery') {
      list = list.filter(c => MONTGOMERY_COUNTY_CITIES.has((c.city ?? '').toLowerCase()))
    } else if (filter === 'maryland') {
      const state = (c: HubSpotCompany) => (c.state ?? '').toLowerCase()
      list = list.filter(c => state(c) === 'md' || state(c) === 'maryland')
    } else if (filter === 'dc') {
      const state = (c: HubSpotCompany) => (c.state ?? '').toLowerCase()
      const city = (c: HubSpotCompany) => (c.city ?? '').toLowerCase()
      list = list.filter(c =>
        state(c) === 'dc' ||
        state(c) === 'district of columbia' ||
        city(c) === 'washington' ||
        city(c) === 'washington dc' ||
        city(c) === 'washington d.c.'
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.state ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    }

    return list
  }, [companies, filter, search])

  if (error) {
    return (
      <div className="space-y-2 py-16 text-center">
        <p className="font-medium text-red-600">Could not connect to HubSpot</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground">
          Create a{' '}
          <a
            href="https://app.hubspot.com/private-apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Private App token
          </a>{' '}
          with <strong>CRM - Companies - Read/Write</strong> scope and update `HUBSPOT_API_KEY`.
        </p>
      </div>
    )
  }

  return (
    <>
      {editing ? (
        <EditModal
          company={editing}
          localAccountId={localAccountIds.get(editing.id) ?? null}
          onClose={() => setEditing(null)}
          onSaved={updated => setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c))}
        />
      ) : null}

      <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-2 text-xs text-muted-foreground">
        {filtered.length} of {companies.length} companies
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Website</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  No companies match your filters.
                </td>
              </tr>
            ) : filtered.map(company => {
              const isImported = imported.has(company.id)
              const localAccountId = localAccountIds.get(company.id)
              return (
                <tr key={company.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-orange-500" />
                      {localAccountId ? (
                        <Link
                          href={`/admin/crm/${localAccountId}`}
                          className="text-sm font-medium text-slate-900 underline-offset-4 transition hover:text-[#ff5a00] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a00]"
                        >
                          {company.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{company.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {[company.address, company.city, company.state, company.zip].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {company.phone ? (
                      <PhoneSmsButton phone={company.phone} recipientName={company.name} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        {company.domain ?? 'Visit'}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isImported ? <Badge variant="success">Imported</Badge> : <Badge variant="outline">HubSpot</Badge>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(company)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!isImported ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingImport === company.id}
                          onClick={() => handleImport(company.id)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          {pendingImport === company.id ? 'Importing...' : 'Import'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
