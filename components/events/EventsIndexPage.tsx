import Link from 'next/link'
import { asc, desc, eq } from 'drizzle-orm'
import { CalendarDays, ImageIcon, MapPin, Search, TicketCheck, UsersRound } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts, eventMedia, eventParticipants, events, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { EVENT_TYPES, getEventAddress } from '@/lib/events/utils'
import { EventCreateDrawer } from './EventCreateDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Filters = { q?: string; view?: string; dateFrom?: string; dateTo?: string; accountId?: string; location?: string; eventType?: string; rsvpStatus?: string; organizerId?: string; error?: string; success?: string }

function statusVariant(status: string) {
  if (status === 'scheduled') return 'success' as const
  if (status === 'cancelled') return 'destructive' as const
  if (status === 'completed') return 'secondary' as const
  return 'warning' as const
}

export async function EventsIndexPage({ mode, filters }: { mode: 'admin' | 'staff'; filters: Filters }) {
  await requireFeature('events', 'admin', 'staff')
  const [eventRows, participantRows, mediaRows, accountOptions, organizerOptions] = await Promise.all([
    db.select({ event: events, accountName: customerAccounts.companyName, organizerName: users.name }).from(events).leftJoin(customerAccounts, eq(events.accountId, customerAccounts.id)).leftJoin(users, eq(events.organizerUserId, users.id)).orderBy(desc(events.startAt)),
    db.select({ eventId: eventParticipants.eventId, rsvpStatus: eventParticipants.rsvpStatus, attendanceStatus: eventParticipants.attendanceStatus }).from(eventParticipants),
    db.select({ eventId: eventMedia.eventId }).from(eventMedia),
    db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName, address: customerAccounts.address, city: customerAccounts.city, state: customerAccounts.state }).from(customerAccounts).orderBy(asc(customerAccounts.companyName)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ])
  const now = new Date()
  const participantsByEvent = new Map<string, typeof participantRows>()
  for (const participant of participantRows) participantsByEvent.set(participant.eventId, [...(participantsByEvent.get(participant.eventId) ?? []), participant])
  const mediaCounts = new Map<string, number>()
  for (const media of mediaRows) mediaCounts.set(media.eventId, (mediaCounts.get(media.eventId) ?? 0) + 1)

  const view = filters.view ?? 'upcoming'
  const q = filters.q?.trim().toLowerCase() ?? ''
  const displayed = eventRows.filter(({ event, accountName, organizerName }) => {
    const participants = participantsByEvent.get(event.id) ?? []
    const haystack = [event.title, event.description, event.venueName, event.city, event.state, accountName, organizerName].filter(Boolean).join(' ').toLowerCase()
    if (q && !haystack.includes(q)) return false
    if (filters.accountId && event.accountId !== filters.accountId) return false
    if (filters.organizerId && event.organizerUserId !== filters.organizerId) return false
    if (filters.eventType && event.eventType !== filters.eventType) return false
    if (filters.location && !getEventAddress(event).toLowerCase().includes(filters.location.toLowerCase())) return false
    if (filters.rsvpStatus && !participants.some((participant) => participant.rsvpStatus === filters.rsvpStatus)) return false
    if (filters.dateFrom && event.startAt < new Date(`${filters.dateFrom}T00:00:00`)) return false
    if (filters.dateTo && event.startAt > new Date(`${filters.dateTo}T23:59:59`)) return false
    if (view === 'draft') return event.status === 'draft'
    if (view === 'cancelled') return event.status === 'cancelled'
    if (view === 'past') return event.status === 'completed' || (event.endAt < now && event.status !== 'cancelled')
    return event.startAt >= now && !['draft', 'cancelled', 'completed'].includes(event.status)
  })
  const tabCounts = {
    upcoming: eventRows.filter(({ event }) => event.startAt >= now && !['draft', 'cancelled', 'completed'].includes(event.status)).length,
    past: eventRows.filter(({ event }) => event.status === 'completed' || (event.endAt < now && event.status !== 'cancelled')).length,
    draft: eventRows.filter(({ event }) => event.status === 'draft').length,
    cancelled: eventRows.filter(({ event }) => event.status === 'cancelled').length,
  }

  return (
    <div className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff5a00]">Community operations</p><h1 className="font-display text-4xl font-bold uppercase text-slate-950">Events</h1><p className="mt-1 text-sm text-slate-500">Create, promote, RSVP, check in, capture content, and follow up.</p></div><EventCreateDrawer accounts={accountOptions} organizers={organizerOptions} /></header>
      {filters.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{filters.error}</div> : null}
      {filters.success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{filters.success}</div> : null}
      <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1" aria-label="Event views">{(['upcoming', 'past', 'draft', 'cancelled'] as const).map((item) => <Link key={item} href={`/${mode}/events?view=${item}`} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold capitalize ${view === item ? 'bg-[#181615] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item} <span className="ml-1 opacity-60">{tabCounts[item]}</span></Link>)}</nav>
      <Card><CardContent className="p-4"><form className="grid gap-3 md:grid-cols-4 xl:grid-cols-8"><input type="hidden" name="view" value={view} /><label className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input name="q" defaultValue={filters.q} placeholder="Search events" className="pl-9" /></label><Input name="dateFrom" type="date" defaultValue={filters.dateFrom} aria-label="From date" /><Input name="dateTo" type="date" defaultValue={filters.dateTo} aria-label="To date" /><select name="accountId" defaultValue={filters.accountId ?? ''}><option value="">All accounts</option>{accountOptions.map((account) => <option key={account.id} value={account.id}>{account.companyName}</option>)}</select><Input name="location" defaultValue={filters.location} placeholder="Location" /><select name="eventType" defaultValue={filters.eventType ?? ''}><option value="">All types</option>{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select name="rsvpStatus" defaultValue={filters.rsvpStatus ?? ''}><option value="">Any RSVP status</option><option value="confirmed">Confirmed</option><option value="maybe">Maybe</option><option value="declined">Declined</option></select><select name="organizerId" defaultValue={filters.organizerId ?? ''}><option value="">All organizers</option>{organizerOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><Button type="submit" variant="outline">Apply filters</Button></form></CardContent></Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {displayed.map(({ event, accountName, organizerName }) => {
          const participants = participantsByEvent.get(event.id) ?? []
          const rsvpCount = participants.filter((participant) => participant.rsvpStatus === 'confirmed').length
          const attendeeCount = participants.filter((participant) => participant.attendanceStatus === 'checked_in').length
          return <Link key={event.id} href={`/${mode}/events/${event.id}`} className="group"><Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-[#ff5a00] group-hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={statusVariant(event.status)}>{event.status}</Badge><Badge variant="outline">{EVENT_TYPES.find(([value]) => value === event.eventType)?.[1] ?? event.eventType}</Badge></div><h2 className="font-display mt-3 text-2xl font-bold uppercase leading-tight text-slate-950">{event.title}</h2><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4 text-[#ff5a00]" />{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timeZone }).format(event.startAt)}</p><p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4 text-[#ff5a00]" />{getEventAddress(event) || 'Location to be announced'}</p>{accountName ? <p className="mt-1 text-xs font-medium text-violet-700">Hosted with {accountName}</p> : null}</div><span className="text-xs text-slate-400">{organizerName ?? 'Unassigned'}</span></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center"><div><TicketCheck className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-lg font-bold">{rsvpCount}</p><p className="text-[11px] uppercase text-slate-400">RSVPs</p></div><div><UsersRound className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-lg font-bold">{attendeeCount}</p><p className="text-[11px] uppercase text-slate-400">Attended</p></div><div><ImageIcon className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-lg font-bold">{mediaCounts.get(event.id) ?? 0}</p><p className="text-[11px] uppercase text-slate-400">Media</p></div></div></CardContent></Card></Link>
        })}
      </div>
      {!displayed.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><CalendarDays className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-semibold">No {view} events match these filters</h2><p className="mt-1 text-sm text-slate-500">Create an event or adjust the search and filters.</p></div> : null}
    </div>
  )
}
