'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Settings2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhoneSmsButton } from './PhoneSmsButton'

const PAGE_SIZE = 200

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

function readStoredColumns(): ColumnKey[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_COLUMNS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS
    const next = parsed.filter((value): value is ColumnKey => COLUMN_OPTIONS.some((option) => option.key === value))
    return next.length ? next : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}

function MobilePersonCard({ person, basePath }: { person: PersonRow; basePath: '/admin/crm' | '/staff/crm' }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-950">{person.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">{person.title ?? 'Title not entered'}</p>
        </div>
        {person.isPrimary ? <Badge variant="success">Primary</Badge> : null}
      </div>

      <Link href={`${basePath}/${person.customerId}`} className="mt-3 block rounded-xl bg-[#f4f1ed] px-3 py-2.5 text-sm font-semibold text-slate-900 underline-offset-4 hover:text-[#d94c00] hover:underline">
        {person.companyName}
      </Link>

      <div className="mt-3 space-y-2 text-sm">
        {person.email ? <a href={`mailto:${person.email}`} className="block break-all text-slate-600 hover:text-[#d94c00] hover:underline">{person.email}</a> : <p className="text-slate-400">No email</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {person.phone ? <PhoneSmsButton phone={person.phone} recipientName={person.name} /> : <span className="text-slate-400">No phone</span>}
          {person.preferredContact ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Prefers {person.preferredContact}</span> : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm"><Link href={`${basePath}/${person.customerId}`}>View account</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={`${basePath}/${person.customerId}/contacts`}>Manage</Link></Button>
      </div>
    </article>
  )
}

export function LocalPeopleTable({
  people,
  basePath,
}: {
  people: PersonRow[]
  basePath: '/admin/crm' | '/staff/crm'
}) {
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [storageReady, setStorageReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setSelectedColumns(readStoredColumns())
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns))
    } catch {}
  }, [selectedColumns, storageReady])

  function toggleColumn(column: ColumnKey) {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        if (prev.length === 1) return prev
        return prev.filter((value) => value !== column)
      }

      const ordered = COLUMN_OPTIONS.map((option) => option.key)
      return ordered.filter((value) => [...prev, column].includes(value))
    })
  }

  const vis = new Set(selectedColumns)
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredPeople = normalizedQuery
    ? people.filter((person) =>
        [person.name, person.title, person.companyName, person.email, person.phone].some((value) =>
          String(value ?? '').toLowerCase().includes(normalizedQuery),
        ),
      )
    : people

  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const paginatedPeople = filteredPeople.slice(pageStart, pageEnd)
  const pageNumberStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const safePageStart = Number.isFinite(pageNumberStart) ? pageNumberStart : 1
  const pageNumberEnd = Math.min(totalPages, Math.max(5, safePageStart + 4))
  const pageNumbers = Array.from({ length: pageNumberEnd - safePageStart + 1 }, (_, index) => safePageStart + index)

  if (people.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No CRM contacts yet. Add contacts to accounts to build your people view.
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Company contacts</p>
          <p className="text-xs text-slate-500">{filteredPeople.length} of {people.length} people associated with accounts</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search people..."
              className="h-10 w-full rounded-md border border-input bg-white pl-8 pr-3 text-sm sm:h-9 sm:min-w-[180px]"
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 sm:h-9 sm:w-auto" onClick={() => setShowColumnPicker((prev) => !prev)}>
              <Settings2 className="h-4 w-4" />
              Customize Columns
            </Button>
            {showColumnPicker ? (
              <div className="absolute right-0 z-20 mt-2 max-h-[70vh] w-[min(15rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">Show / Hide Columns</p>
                  <button type="button" onClick={() => setShowColumnPicker(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5 p-3">
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
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
        <p>
          {filteredPeople.length === 0 ? '0 results' : `Showing ${pageStart + 1}-${Math.min(pageEnd, filteredPeople.length)} of ${filteredPeople.length}`}
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

      <div className="space-y-3 p-3 md:hidden">
        {paginatedPeople.map((person) => <MobilePersonCard key={person.id} person={person} basePath={basePath} />)}
        {paginatedPeople.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No people match your search.</p> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            {vis.has('person') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Person</th> : null}
            {vis.has('title') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th> : null}
            {vis.has('company') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th> : null}
            {vis.has('phone') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th> : null}
            {vis.has('phoneType') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone Type</th> : null}
            {vis.has('email') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th> : null}
            {vis.has('preferredContact') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferred</th> : null}
            {vis.has('isPrimary') ? <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</th> : null}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {paginatedPeople.length === 0 ? (
            <tr>
              <td colSpan={99} className="px-6 py-10 text-center text-sm text-muted-foreground">No people match your search.</td>
            </tr>
          ) : null}
          {paginatedPeople.map((person) => (
            <tr key={person.id} className="transition-colors hover:bg-slate-50">
              {vis.has('person') ? (
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{person.name}</p>
                </td>
              ) : null}
              {vis.has('title') ? <td className="px-4 py-3 text-sm text-muted-foreground">{person.title ?? '-'}</td> : null}
              {vis.has('company') ? (
                <td className="px-4 py-3 text-sm font-medium">
                  <Link
                    href={`${basePath}/${person.customerId}`}
                    className="text-slate-900 underline-offset-4 transition hover:text-[#ff5a00] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a00]"
                  >
                    {person.companyName}
                  </Link>
                </td>
              ) : null}
              {vis.has('phone') ? (
                <td className="px-4 py-3 text-sm">
                  {person.phone ? (
                    <PhoneSmsButton phone={person.phone} recipientName={person.name} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              ) : null}
              {vis.has('phoneType') ? <td className="px-4 py-3 text-sm capitalize text-muted-foreground">{person.phoneType ?? '-'}</td> : null}
              {vis.has('email') ? <td className="px-4 py-3 text-sm text-muted-foreground">{person.email ?? '-'}</td> : null}
              {vis.has('preferredContact') ? (
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {person.preferredContact ? person.preferredContact.toUpperCase() : '-'}
                </td>
              ) : null}
              {vis.has('isPrimary') ? (
                <td className="px-4 py-3">
                  {person.isPrimary ? <Badge variant="success">Primary</Badge> : <span className="text-xs text-muted-foreground">-</span>}
                </td>
              ) : null}
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

      {filteredPeople.length > PAGE_SIZE ? (
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
