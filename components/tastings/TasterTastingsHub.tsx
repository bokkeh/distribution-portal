'use client'

import Link from 'next/link'
import { format, isBefore } from 'date-fns'
import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardCheck, MapPin, Phone, Receipt } from 'lucide-react'
import { formatEasternTimeRange } from '@/lib/tastings/time'
import { cn } from '@/lib/utils'
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
  tasterName?: string | null
  reportSubmittedAt?: Date | null
  invoiceSubmittedAt?: Date | null
  invoiceStatus?: string | null
}

function formatTimeRange(start: Date, end: Date | null) {
  return formatEasternTimeRange(start, end)
}

const statusClasses: Record<string, string> = {
  requested: 'border-[#181615] bg-[#181615] text-white',
  scheduled: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completed: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-500 bg-red-50 text-red-700',
  declined: 'border-red-500 bg-red-50 text-red-700',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap rounded-[4px] px-2 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.04em] shadow-none',
        statusClasses[status] ?? statusClasses.requested,
      )}
    >
      {status}
    </Badge>
  )
}

function TastingDateTile({ tasting }: { tasting: Pick<TastingRow, 'scheduledAt' | 'endAt'> }) {
  const tastingDate = new Date(tasting.scheduledAt)

  return (
    <div className="flex min-h-[150px] min-w-[96px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-[0_1px_2px_rgba(24,22,21,0.03)]">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#ff4f00]">
        {format(tastingDate, 'MMM')}
      </span>
      <span className="font-display mt-1 text-4xl font-bold leading-none text-[#181615]">
        {format(tastingDate, 'dd')}
      </span>
      <span className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
        {format(tastingDate, 'EEE')}
      </span>
      <span className="mt-3 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-[#ff4f00]">
        {formatTimeRange(tastingDate, tasting.endAt ? new Date(tasting.endAt) : null)}
      </span>
    </div>
  )
}

function YearMarker({ year }: { year: string }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator" aria-label={`Tastings from ${year}`}>
      <div className="h-px flex-1 bg-slate-200" />
      <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-sm font-semibold text-slate-600">
        {year}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  )
}

function getReportActionLabel(tasting: Pick<TastingRow, 'status' | 'reportSubmittedAt'>) {
  if (tasting.reportSubmittedAt) return 'View Report'
  if (tasting.status === 'completed') return 'Complete Report'
  return 'Add Report'
}

function TastingCard({ tasting }: { tasting: TastingRow }) {
  const missingReport = tasting.status === 'completed' && !tasting.reportSubmittedAt
  const invoiceEligible = Boolean(tasting.reportSubmittedAt) || tasting.status === 'completed'
  const missingInvoice = invoiceEligible && !tasting.invoiceSubmittedAt

  return (
    <div className="grid gap-5 rounded-2xl border border-slate-200 bg-[#faf9f7] p-4 transition-colors hover:border-stone-300 sm:p-5 md:grid-cols-[104px_minmax(0,1fr)_auto] md:items-center md:gap-6">
      <TastingDateTile tasting={tasting} />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-lg font-bold text-[#181615] sm:text-xl">{tasting.eventName}</p>
          <StatusBadge status={tasting.status} />
        </div>
        {tasting.tasterName ? (
          <p className="text-sm text-stone-600">
            Assigned to <span className="font-semibold text-[#181615]">{tasting.tasterName}</span>
          </p>
        ) : null}
        <p className="flex items-start gap-2 text-sm text-stone-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
          <span>{[tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'}</span>
        </p>
        {tasting.notes ? (
          <p className="rounded-lg border border-stone-200 bg-white/70 px-3 py-2 text-sm text-stone-600">{tasting.notes}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {tasting.reportSubmittedAt ? <Badge variant="success">Report Submitted</Badge> : null}
          {missingReport ? <Badge variant="warning">Missing Report</Badge> : null}
          {tasting.invoiceSubmittedAt ? <Badge variant="info">Invoice {tasting.invoiceStatus ?? 'submitted'}</Badge> : null}
          {missingInvoice ? <Badge variant="warning">Invoice Needed</Badge> : null}
        </div>
      </div>
      <div className="flex flex-col items-start gap-4 md:min-w-[280px] md:items-end">
        {tasting.storePhone ? (
          <a href={`tel:${tasting.storePhone}`} className="inline-flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-[#181615]">
            <Phone className="h-4 w-4 text-stone-700" aria-hidden="true" />
            {tasting.storePhone}
          </a>
        ) : (
          <span className="text-sm text-stone-400">No store phone on file</span>
        )}
        <div className="flex flex-wrap gap-2.5 md:justify-end">
          <Button asChild className="font-display h-10 px-4 text-xs uppercase tracking-[0.03em]">
            <Link href={`/taster/tastings/${tasting.id}#report`}>
              <ClipboardCheck className="h-4 w-4" />
              {getReportActionLabel(tasting)}
            </Link>
          </Button>
          {invoiceEligible ? (
            <Button asChild className="font-display h-10 border-[#181615] px-4 text-xs uppercase tracking-[0.03em] text-[#181615]" variant="outline">
              <Link href={`/taster/tastings/${tasting.id}#invoice`}>
                <Receipt className="h-4 w-4" />
                {tasting.invoiceSubmittedAt ? 'View Invoice' : 'Submit Invoice'}
              </Link>
            </Button>
          ) : null}
          <Button asChild className="font-display h-10 border-[#181615] px-4 text-xs uppercase tracking-[0.03em] text-[#181615]" variant="outline">
            <Link href={`/taster/tastings/${tasting.id}`}>View Details</Link>
          </Button>
        </div>
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
  const missingInvoiceCount = tastings.filter(tasting => (Boolean(tasting.reportSubmittedAt) || tasting.status === 'completed') && !tasting.invoiceSubmittedAt).length
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
  const displayedTastings = activeTab === 'upcoming' ? upcoming : filteredPast

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

      <Card className="overflow-hidden rounded-[22px] border-slate-200 bg-white shadow-none">
        <CardHeader className="px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="font-display text-2xl uppercase tracking-[-0.02em] text-[#181615]">
              {activeTab === 'upcoming' ? 'Upcoming Tastings' : 'Previous Tastings'}
            </CardTitle>
            <div className="inline-flex gap-2" role="tablist" aria-label="Tasting history">
              <button
                id="taster-upcoming-tastings-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'upcoming'}
                aria-controls="taster-tasting-list-panel"
                onClick={() => setActiveTab('upcoming')}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                  activeTab === 'upcoming'
                    ? 'border-[#181615] bg-[#181615] text-white'
                    : 'border-slate-200 bg-white text-stone-500 hover:border-stone-400 hover:text-[#181615]'
                )}
              >
                Upcoming <span className="ml-1">{upcoming.length}</span>
              </button>
              <button
                id="taster-previous-tastings-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'previous'}
                aria-controls="taster-tasting-list-panel"
                onClick={() => setActiveTab('previous')}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                  activeTab === 'previous'
                    ? 'border-[#181615] bg-[#181615] text-white'
                    : 'border-slate-200 bg-white text-stone-500 hover:border-stone-400 hover:text-[#181615]'
                )}
              >
                Previous <span className="ml-1">{past.length}</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent
          id="taster-tasting-list-panel"
          role="tabpanel"
          aria-labelledby={`taster-${activeTab}-tastings-tab`}
          className="space-y-4 px-5 pb-6 sm:px-7 sm:pb-7"
        >
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

          {displayedTastings.length ? displayedTastings.map((tasting, index, visibleTastings) => {
            const tastingYear = format(new Date(tasting.scheduledAt), 'yyyy')
            const previousTastingYear = index > 0
              ? format(new Date(visibleTastings[index - 1].scheduledAt), 'yyyy')
              : null
            const showYearMarker = activeTab === 'previous' && tastingYear !== previousTastingYear

            return (
              <Fragment key={tasting.id}>
                {showYearMarker ? <YearMarker year={tastingYear} /> : null}
                <TastingCard tasting={tasting} />
              </Fragment>
            )
          }) : (
            <p className="text-sm text-slate-500">
              {activeTab === 'upcoming' ? 'No upcoming tastings assigned right now.' : 'No past tastings match this date range.'}
            </p>
          )}
        </CardContent>
      </Card>

      <TastingMapPanel tastings={upcoming} />
    </div>
  )
}
