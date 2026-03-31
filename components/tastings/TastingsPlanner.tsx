'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isBefore, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, Clock3, MapPin, Store } from 'lucide-react'
import { createTasting, deleteTasting, reassignTasting, updateTastingStatus } from '@/actions/tastings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatEasternTimeRange } from '@/lib/tastings/time'
import { cn } from '@/lib/utils'
import { TastingScheduleAssistant } from './TastingScheduleAssistant'

type TastingRow = {
  id: string
  customerId: string
  assignedUserId: string
  createdByUserId: string
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
  createdAt: Date
  tasterName: string
  tasterPhone: string | null
  reportSubmittedAt?: Date | null
  invoiceSubmittedAt?: Date | null
  invoiceStatus?: string | null
}

interface Props {
  mode: 'admin' | 'staff' | 'taster'
  tastings: TastingRow[]
  accounts: Array<{ id: string; companyName: string; address: string | null; city: string | null; state: string | null; zip: string | null }>
  tasters: Array<{ id: string; name: string; phone: string | null; avatarUrl?: string | null }>
  success?: string
  error?: string
}

const statusVariant: Record<string, 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  requested: 'secondary',
  scheduled: 'info',
  confirmed: 'warning',
  completed: 'success',
  cancelled: 'destructive',
  declined: 'destructive',
}

function formatTastingTimeRange(start: Date, end: Date | null) {
  return formatEasternTimeRange(start, end)
}

function isMissingReport(tasting: Pick<TastingRow, 'reportSubmittedAt' | 'status'>) {
  return tasting.status === 'completed' && !tasting.reportSubmittedAt
}

export function TastingsPlanner({ mode, tastings, accounts, tasters, success, error }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [previousFrom, setPreviousFrom] = useState('')
  const [previousTo, setPreviousTo] = useState('')
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [visibleMonth])

  const dayTastings = tastings.filter(tasting => isSameDay(new Date(tasting.scheduledAt), selectedDate))
  const now = new Date()
  const upcomingTastings = tastings.filter(tasting => !isBefore(new Date(tasting.scheduledAt), now))
  const previousTastings = tastings.filter(tasting => isBefore(new Date(tasting.scheduledAt), now))
  const filteredPreviousTastings = useMemo(() => {
    return previousTastings.filter((tasting) => {
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
  }, [previousFrom, previousTo, previousTastings])

  return (
    <div className="space-y-6">
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-slate-500" />
                Tastings Calendar
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Click a date to review or schedule tastings.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}>Prev</Button>
              <div className="min-w-32 text-center text-sm font-medium text-slate-700">{format(visibleMonth, 'MMMM yyyy')}</div>
              <Button type="button" variant="outline" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>Next</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(label => <div key={label}>{label}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map(day => {
                const events = tastings.filter(tasting => isSameDay(new Date(tasting.scheduledAt), day))
                const isSelected = isSameDay(day, selectedDate)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'min-h-24 rounded-2xl border p-2 text-left transition-colors',
                      isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300',
                      !isSameMonth(day, visibleMonth) && 'opacity-45'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-semibold', isSelected ? 'text-blue-700' : 'text-slate-800')}>{format(day, 'd')}</span>
                      {events.length ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">
                          {events.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {events.slice(0, 2).map(event => (
                        <div key={event.id} className="truncate rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                          {formatTastingTimeRange(new Date(event.scheduledAt), event.endAt ? new Date(event.endAt) : null)} {event.eventName}
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'taster' ? 'Selected Day' : 'Schedule A Tasting'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'taster' ? null : (
              <form action={createTasting} className="space-y-4">
                <input type="hidden" name="mode" value={mode} />
                <div className="space-y-2">
                  <Label htmlFor="customerId">Store Account</Label>
                  <select
                    id="customerId"
                    name="customerId"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    required
                    onChange={e => setSelectedAccountId(e.target.value)}
                    value={selectedAccountId}
                  >
                    <option value="">Select store</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.companyName} {account.city ? `- ${account.city}, ${account.state ?? ''}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAccountId && (
                  <TastingScheduleAssistant
                    accountId={selectedAccountId}
                    accountName={accounts.find(a => a.id === selectedAccountId)?.companyName ?? ''}
                    onSelectSlot={(date) => setDateInput(date)}
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="assignedUserId">Assign Taster</Label>
                  <select id="assignedUserId" name="assignedUserId" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                    <option value="">Select taster</option>
                    {tasters.map(taster => (
                      <option key={taster.id} value={taster.id}>
                        {taster.name}{taster.phone ? ` (${taster.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Start Time (ET)</Label>
                    <Input id="time" name="time" type="time" defaultValue="17:00" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time (ET)</Label>
                  <Input id="endTime" name="endTime" type="time" defaultValue="19:00" />
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" name="trainingDay" className="mt-0.5 accent-blue-600" />
                  <span>
                    <span className="block font-medium text-slate-900">Training day</span>
                    <span className="block text-xs text-slate-500">Allows a second taster at the same store on the same date for onboarding or shadowing.</span>
                  </span>
                </label>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Sampling notes, promo setup, timing, or store instructions."
                  />
                </div>

                <Button type="submit" className="w-full">Create And Notify Taster</Button>
              </form>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{format(selectedDate, 'EEEE, MMM d')} (ET schedule)</p>
                  <p className="text-xs text-slate-500">{dayTastings.length} tasting{dayTastings.length === 1 ? '' : 's'} scheduled</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {dayTastings.length ? dayTastings.map(tasting => (
                  <div key={tasting.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{tasting.eventName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatTastingTimeRange(new Date(tasting.scheduledAt), tasting.endAt ? new Date(tasting.endAt) : null)}</span>
                          <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" />{tasting.tasterName}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant[tasting.status] ?? 'secondary'}>{tasting.status}</Badge>
                        {isMissingReport(tasting) ? <Badge variant="warning">Missing Report</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span>{[tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'}</span>
                      </p>
                      {tasting.notes ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{tasting.notes}</p> : null}
                    </div>

                    <form action={updateTastingStatus} className="mt-4 flex flex-wrap gap-2">
                      <input type="hidden" name="tastingId" value={tasting.id} />
                      <input type="hidden" name="mode" value={mode} />
                      {(
                        tasting.status === 'requested'
                          ? ['scheduled', 'cancelled']
                          : tasting.status === 'scheduled'
                            ? ['confirmed', 'cancelled']
                            : tasting.status === 'confirmed'
                              ? ['completed', 'cancelled']
                              : []
                      ).map(status => (
                        <Button
                          key={status}
                          type="submit"
                          name="status"
                          value={status}
                          variant={status === tasting.status ? 'default' : 'outline'}
                          size="sm"
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Button>
                      ))}
                    </form>

                    {mode !== 'taster' ? (
                      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <form action={reassignTasting} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <input type="hidden" name="tastingId" value={tasting.id} />
                          <input type="hidden" name="mode" value={mode} />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={`${mode}-reassign-${tasting.id}`}>Reassign Taster</Label>
                            <select
                              id={`${mode}-reassign-${tasting.id}`}
                              name="assignedUserId"
                              defaultValue={tasting.assignedUserId}
                              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                            >
                              {tasters.map(taster => (
                                <option key={taster.id} value={taster.id}>
                                  {taster.name}{taster.phone ? ` (${taster.phone})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button type="submit" variant="outline">Reassign</Button>
                        </form>

                        <form action={deleteTasting}>
                          <input type="hidden" name="tastingId" value={tasting.id} />
                          <input type="hidden" name="mode" value={mode} />
                          <ConfirmSubmitButton variant="destructive" className="w-full sm:w-auto" title="Remove this tasting?" description="This will permanently delete the tasting and notify the assigned taster." confirmLabel="Remove Tasting">Remove Tasting</ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No tastings on this date yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              {activeTab === 'upcoming'
                ? (mode === 'taster' ? 'My Upcoming Tastings' : 'Upcoming Tastings')
                : 'Previous Tastings'}
            </CardTitle>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Upcoming
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{upcomingTastings.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('previous')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === 'previous' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Previous
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{previousTastings.length}</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTab === 'previous' ? (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor={`${mode}-previous-from`} className="text-xs uppercase tracking-wide text-slate-500">From</Label>
                <Input
                  id={`${mode}-previous-from`}
                  type="date"
                  value={previousFrom}
                  onChange={(event) => setPreviousFrom(event.target.value)}
                  className="w-auto min-w-[160px] bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${mode}-previous-to`} className="text-xs uppercase tracking-wide text-slate-500">To</Label>
                <Input
                  id={`${mode}-previous-to`}
                  type="date"
                  value={previousTo}
                  onChange={(event) => setPreviousTo(event.target.value)}
                  className="w-auto min-w-[160px] bg-white"
                />
              </div>
              {(previousFrom || previousTo) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreviousFrom('')
                    setPreviousTo('')
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          ) : null}

          {(activeTab === 'upcoming' ? upcomingTastings : filteredPreviousTastings).length ? (activeTab === 'upcoming' ? upcomingTastings : filteredPreviousTastings).map(tasting => (
            <div key={tasting.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex min-w-[84px] flex-col items-center rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                    {format(new Date(tasting.scheduledAt), 'MMM')}
                  </span>
                  <span className="mt-1 text-3xl font-bold leading-none text-slate-900">
                    {format(new Date(tasting.scheduledAt), 'd')}
                  </span>
                  <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {format(new Date(tasting.scheduledAt), 'EEE')}
                  </span>
                  <span className="mt-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm">
                    {formatTastingTimeRange(new Date(tasting.scheduledAt), tasting.endAt ? new Date(tasting.endAt) : null)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{tasting.eventName}</p>
                    <Badge variant={statusVariant[tasting.status] ?? 'secondary'}>{tasting.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">with {tasting.tasterName}</p>
                  <p className="text-sm text-slate-500">{[tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tasting.reportSubmittedAt ? <Badge variant="success">Report Submitted</Badge> : null}
                    {isMissingReport(tasting) ? <Badge variant="warning">Missing Report</Badge> : null}
                    {tasting.invoiceSubmittedAt ? <Badge variant="info">Invoice {tasting.invoiceStatus ?? 'submitted'}</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <div className="text-sm text-slate-500">{tasting.storePhone ?? 'No store phone on file'}</div>
                {mode === 'taster' ? (
                  <Link href={`/taster/tastings/${tasting.id}`}>
                    <Button size="sm">Open Report</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          )) : (
            <p className="text-sm text-slate-500">
              {activeTab === 'upcoming' ? 'No upcoming tastings scheduled yet.' : 'No previous tastings match this date range.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
