'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth } from 'date-fns'
import { addAvailabilityForUser } from '@/actions/taster-availability'
import { ViewAsButton } from '@/components/admin/ViewAsButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatEasternTimeRange } from '@/lib/tastings/time'
import { toDisplayAvatarUrl } from '@/lib/users/avatar'
import { toast } from 'sonner'

const AVAILABILITY_MONTH_COUNT = 6

type TeamTaster = {
  id: string
  name: string
  phone: string | null
  avatarUrl?: string | null
}

type AvailabilityRow = {
  userId: string
  availableDate: string
}

type TastingRow = {
  id: string
  assignedUserId: string
  scheduledAt: Date
  endAt: Date | null
  status: string
}

function initialsForName(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'T'
}

function TasterAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false)
  const displayAvatarUrl = imageFailed ? null : toDisplayAvatarUrl(avatarUrl)

  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-full border border-blue-200 bg-blue-50">
      {displayAvatarUrl ? (
        <Image
          src={displayAvatarUrl}
          alt={name}
          fill
          className="object-cover"
          unoptimized={displayAvatarUrl.includes('googleusercontent.com') || displayAvatarUrl.startsWith('/api/')}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-blue-700">
          {initialsForName(name)}
        </div>
      )}
    </div>
  )
}

function isBookedStatus(status: string) {
  return status === 'scheduled' || status === 'confirmed'
}

function isTastingDay(date: Date) {
  const day = getDay(date)
  return day === 5 || day === 6 || day === 0
}

export function TasterTeamPanel({
  mode,
  tasters,
  tastings,
  availability,
}: {
  mode: 'admin' | 'staff'
  tasters: TeamTaster[]
  tastings: TastingRow[]
  availability: AvailabilityRow[]
}) {
  const router = useRouter()
  const [view, setView] = useState<'roster' | 'availability'>('roster')
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedTasterId, setSelectedTasterId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const selectedMonth = useMemo(() => startOfMonth(addMonths(new Date(), monthOffset)), [monthOffset])
  const monthOptions = useMemo(
    () => Array.from({ length: AVAILABILITY_MONTH_COUNT }, (_, index) => ({
      index,
      label: format(addMonths(new Date(), index), 'MMMM yyyy'),
    })),
    [],
  )

  const tastingDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) }).filter(isTastingDay),
    [selectedMonth],
  )

  const bookedTastings = useMemo(
    () => tastings.filter((tasting) => isBookedStatus(tasting.status)),
    [tastings],
  )
  const availabilitySet = useMemo(
    () => new Set(availability.map((row) => `${row.userId}:${row.availableDate}`)),
    [availability],
  )

  const rosterRows = useMemo(() => {
    return tasters.map((taster) => {
      const assigned = bookedTastings.filter((tasting) => tasting.assignedUserId === taster.id)
      const bookedThisMonth = assigned.filter((tasting) => format(new Date(tasting.scheduledAt), 'yyyy-MM') === format(selectedMonth, 'yyyy-MM'))
      const bookedDayKeys = new Set(bookedThisMonth.map((tasting) => format(new Date(tasting.scheduledAt), 'yyyy-MM-dd')))
      const availableDayCount = tastingDays.filter((day) => availabilitySet.has(`${taster.id}:${format(day, 'yyyy-MM-dd')}`)).length
      const nextTasting = assigned
        .map((tasting) => new Date(tasting.scheduledAt))
        .filter((date) => date >= new Date())
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null

      return {
        ...taster,
        bookedCount: bookedThisMonth.length,
        availableDayCount,
        openDays: Math.max(availableDayCount - bookedDayKeys.size, 0),
        nextTasting,
      }
    })
  }, [availabilitySet, bookedTastings, selectedMonth, tasters, tastingDays])

  const availabilityRows = useMemo(() => {
    return tastingDays.map((day) => {
      const dayBookings = bookedTastings.filter((tasting) => isSameDay(new Date(tasting.scheduledAt), day))
      const bookedIds = new Set(dayBookings.map((tasting) => tasting.assignedUserId))

      return {
        day,
        booked: tasters
          .filter((taster) => bookedIds.has(taster.id))
          .map((taster) => {
            const tasting = dayBookings.find((entry) => entry.assignedUserId === taster.id) ?? null
            return {
              ...taster,
              tasting,
            }
          }),
        open: tasters.filter((taster) => !bookedIds.has(taster.id) && availabilitySet.has(`${taster.id}:${format(day, 'yyyy-MM-dd')}`)),
      }
    })
  }, [availabilitySet, bookedTastings, tasters, tastingDays])

  function addManualAvailability() {
    if (!selectedTasterId || !selectedDate) {
      toast.error('Choose a taster and date first.')
      return
    }

    startTransition(async () => {
      const result = await addAvailabilityForUser({
        userId: selectedTasterId,
        availableDate: selectedDate,
      })

      if (result?.error) {
        toast.error(result.error)
        return
      }

      toast.success('Availability added')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-slate-900">Taster Team</CardTitle>
            <p className="mt-1 text-sm text-slate-500">See the current roster and review team coverage before scheduling next month&apos;s tastings.</p>
          </div>
          {mode === 'admin' ? (
            <Link href="/admin/users/new">
              <Button variant="outline">Add New Taster</Button>
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-6 border-b border-slate-200">
          {[
            { id: 'roster', label: 'Tasters' },
            { id: 'availability', label: 'Availability' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id as 'roster' | 'availability')}
              className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                view === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {view === 'roster' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 text-left">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Taster</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">{format(selectedMonth, 'MMM')} Available</th>
                  <th className="px-3 py-3 font-medium">{format(selectedMonth, 'MMM')} Booked</th>
                  <th className="px-3 py-3 font-medium">Open Tasting Days</th>
                  <th className="px-3 py-3 font-medium">Next Tasting</th>
                  {mode === 'admin' ? <th className="px-3 py-3 font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rosterRows.map((taster) => (
                  <tr key={taster.id}>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <TasterAvatar name={taster.name} avatarUrl={taster.avatarUrl} />
                        <div>
                          <p className="font-medium text-slate-900">{taster.name}</p>
                          <p className="text-xs text-slate-500">Taster</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-600">{taster.phone ?? 'No phone on file'}</td>
                    <td className="px-3 py-4 text-sm text-slate-600">{taster.availableDayCount > 0 ? `${taster.availableDayCount} submitted` : 'No availability set'}</td>
                    <td className="px-3 py-4 text-sm font-medium text-slate-900">{taster.bookedCount}</td>
                    <td className="px-3 py-4 text-sm text-emerald-700">{taster.openDays} open</td>
                    <td className="px-3 py-4 text-sm text-slate-600">{taster.nextTasting ? format(taster.nextTasting, 'EEE, MMM d') : 'No upcoming tasting'}</td>
                    {mode === 'admin' ? (
                      <td className="px-3 py-4">
                        <ViewAsButton
                          userId={taster.id}
                          userName={taster.name}
                          role="taster"
                          label="View taster portal"
                          className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {mode === 'admin' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add Availability Manually</p>
                    <p className="mt-1 text-sm text-slate-500">Pick a taster and tasting day in the selected month to mark them available.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <Select value={selectedTasterId} onValueChange={setSelectedTasterId}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder="Select taster" />
                    </SelectTrigger>
                    <SelectContent>
                      {tasters.map((taster) => (
                        <SelectItem key={taster.id} value={taster.id}>
                          {taster.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedDate} onValueChange={setSelectedDate}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder="Select date" />
                    </SelectTrigger>
                    <SelectContent>
                      {tastingDays.map((day) => {
                        const value = format(day, 'yyyy-MM-dd')
                        return (
                          <SelectItem key={value} value={value}>
                            {format(day, 'EEE, MMM d')}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addManualAvailability} disabled={isPending || !selectedTasterId || !selectedDate}>
                    {isPending ? 'Adding...' : 'Add Availability'}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {monthOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setMonthOffset(option.index)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    monthOffset === option.index
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="max-h-[640px] overflow-y-auto pr-1">
              <div className="space-y-0">
                {availabilityRows.map((row) => (
                  <div key={row.day.toISOString()} className="border-b border-slate-200 py-4">
                    <div className="grid gap-3 lg:grid-cols-[140px_1fr]">
                      <div className="text-sm font-semibold text-slate-800">{format(row.day, 'EEE MMM d')}</div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {row.booked.length ? row.booked.map((entry) => (
                            <span
                              key={`booked-${row.day.toISOString()}-${entry.id}`}
                              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
                            >
                              <span>{entry.name}</span>
                              <span className="text-[11px] uppercase tracking-wide text-amber-600">
                                booked {entry.tasting ? formatEasternTimeRange(new Date(entry.tasting.scheduledAt), entry.tasting.endAt ? new Date(entry.tasting.endAt) : null) : ''}
                              </span>
                            </span>
                          )) : (
                            <span className="text-sm italic text-slate-400">No one booked</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.open.length ? row.open.map((entry) => (
                            <span
                              key={`open-${row.day.toISOString()}-${entry.id}`}
                              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                            >
                              {entry.name}
                            </span>
                          )) : (
                            <span className="text-sm italic text-slate-400">No one free</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
