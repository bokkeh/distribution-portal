'use client'

import Link from 'next/link'
import { format, isBefore } from 'date-fns'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardCheck, Clock3, FileText, Receipt, Store } from 'lucide-react'
import { formatEasternDate, formatEasternTimeRange } from '@/lib/tastings/time'
import { TastingMapPanel } from './TastingMapPanel'

type TastingRow = {
  id: string
  eventName: string
  scheduledAt: Date
  endAt: Date | null
  status: string
  storeAddress: string | null
  storeCity: string | null
  storeState: string | null
  storeZip: string | null
  storePhone: string | null
  notes: string | null
  reportSubmittedAt?: Date | null
  invoiceSubmittedAt?: Date | null
  invoiceStatus?: string | null
}

function formatTimeRange(start: Date, end: Date | null) {
  return formatEasternTimeRange(start, end)
}

const statusVariant: Record<string, 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  scheduled: 'info',
  confirmed: 'warning',
  completed: 'success',
  cancelled: 'destructive',
}

function TastingCard({ tasting, compact = false }: { tasting: TastingRow; compact?: boolean }) {
  const tastingDate = new Date(tasting.scheduledAt)
  const missingReport = !tasting.reportSubmittedAt && tasting.status !== 'cancelled'
  const missingInvoice = tasting.status === 'completed' && !tasting.invoiceSubmittedAt

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex min-w-[88px] flex-col items-center rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              {format(tastingDate, 'MMM')}
            </span>
            <span className="mt-1 text-3xl font-bold leading-none text-slate-900">
              {format(tastingDate, 'd')}
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {format(tastingDate, 'EEE')}
            </span>
            <span className="mt-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm">
              {formatTimeRange(tastingDate, tasting.endAt ? new Date(tasting.endAt) : null)}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{tasting.eventName}</p>
              <Badge variant={statusVariant[tasting.status] ?? 'secondary'}>{tasting.status}</Badge>
            </div>
            <p className="text-sm text-slate-500">{formatEasternDate(tastingDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tasting.reportSubmittedAt ? <Badge variant="success">Report Submitted</Badge> : null}
          {missingReport ? <Badge variant="warning">Missing Report</Badge> : null}
          {tasting.invoiceSubmittedAt ? <Badge variant="info">Invoice {tasting.invoiceStatus ?? 'submitted'}</Badge> : null}
          {missingInvoice ? <Badge variant="warning">Invoice Needed</Badge> : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <p className="flex items-start gap-2">
          <Store className="mt-0.5 h-4 w-4 text-slate-400" />
          <span>{[tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'}</span>
        </p>
        <p className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
          <span>{tasting.storePhone ?? 'No store phone on file'}</span>
        </p>
      </div>

      {tasting.notes ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {tasting.notes}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/taster/tastings/${tasting.id}#report`}>
          <Button size="sm" variant={missingReport ? 'default' : 'outline'} className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            {tasting.reportSubmittedAt ? 'View Report' : 'Complete Report'}
          </Button>
        </Link>
        <Link href={`/taster/tastings/${tasting.id}#invoice`}>
          <Button size="sm" variant={missingInvoice ? 'default' : 'outline'} className="gap-2">
            <Receipt className="h-4 w-4" />
            {tasting.invoiceSubmittedAt ? 'View Invoice' : 'Submit Invoice'}
          </Button>
        </Link>
        {!compact ? (
          <Link href={`/taster/tastings/${tasting.id}`}>
            <Button size="sm" variant="ghost" className="gap-2">
              <FileText className="h-4 w-4" />
              Open Details
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export function TasterTastingsHub({
  tastings,
  success,
  error,
}: {
  tastings: TastingRow[]
  success?: string
  error?: string
}) {
  const now = new Date()
  const upcoming = tastings.filter(tasting => !isBefore(new Date(tasting.scheduledAt), now))
  const past = tastings.filter(tasting => isBefore(new Date(tasting.scheduledAt), now))
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [previousFrom, setPreviousFrom] = useState('')
  const [previousTo, setPreviousTo] = useState('')
  const missingReportCount = tastings.filter(tasting => tasting.status === 'completed' && !tasting.reportSubmittedAt).length
  const missingInvoiceCount = tastings.filter(tasting => tasting.status === 'completed' && !tasting.invoiceSubmittedAt).length
  const filteredPast = past.filter(tasting => {
    const tastingDate = new Date(tasting.scheduledAt)
    if (previousFrom) {
      const from = new Date(`${previousFrom}T00:00:00`)
      if (tastingDate < from) return false
    }
    if (previousTo) {
      const to = new Date(`${previousTo}T23:59:59.999`)
      if (tastingDate > to) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Upcoming Tastings</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-slate-900">{upcoming.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Reports Needed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-amber-600">{missingReportCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Invoices Needed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-orange-600">{missingInvoiceCount}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{activeTab === 'upcoming' ? 'Upcoming Tastings' : 'Previous Tastings'}</CardTitle>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Upcoming
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{upcoming.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('previous')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === 'previous' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Previous
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{past.length}</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTab === 'previous' ? (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="space-y-1 text-sm text-slate-600">
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">From</span>
                <input
                  type="date"
                  value={previousFrom}
                  onChange={event => setPreviousFrom(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-600">
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">To</span>
                <input
                  type="date"
                  value={previousTo}
                  onChange={event => setPreviousTo(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </label>
              {(previousFrom || previousTo) ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setPreviousFrom('')
                  setPreviousTo('')
                }}>
                  Clear
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'upcoming' ? (
            upcoming.length ? upcoming.map(tasting => (
              <TastingCard key={tasting.id} tasting={tasting} />
            )) : (
              <p className="text-sm text-slate-500">No upcoming tastings assigned right now.</p>
            )
          ) : (
            filteredPast.length ? filteredPast.map(tasting => (
              <TastingCard key={tasting.id} tasting={tasting} compact />
            )) : (
              <p className="text-sm text-slate-500">No past tastings match this date range.</p>
            )
          )}
        </CardContent>
      </Card>

      <TastingMapPanel tastings={upcoming} />
    </div>
  )
}
