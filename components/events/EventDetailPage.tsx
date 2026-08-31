import Image from 'next/image'
import Link from 'next/link'
import { asc, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Activity, ArrowLeft, BarChart3, CalendarCheck, CalendarDays, CheckCircle2, Download, ExternalLink, ImageIcon, Printer, QrCode, Send, Settings2, UsersRound } from 'lucide-react'
import {
  addExistingEventAttendee,
  addNewEventAttendee,
  cancelEvent,
  completeEvent,
  moderateEventMedia,
  removeEventMedia,
  removeEventParticipant,
  saveEventReminders,
  sendEventCommunication,
  updateEventDetails,
  updateEventParticipant,
  updateEventPublishing,
} from '@/actions/events'
import { ActivityTimeline } from '@/components/activity/ActivityTimeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db } from '@/db'
import { communityContacts, customerAccounts, eventCommunications, eventMedia, eventParticipants, eventReminders, events, users } from '@/db/schema'
import { getActivityTimeline } from '@/lib/activity/read'
import { requireFeature } from '@/lib/auth/session'
import { EVENT_TYPES, RSVP_OPTIONAL_FIELDS, formatEventDateTime, getDirectionsUrl, getEventAddress, getEventPublicUrl } from '@/lib/events/utils'
import { EventCsvImport } from './EventCsvImport'
import { EventMediaUploader } from './EventMediaUploader'
import { EventDeleteButton } from './EventDeleteButton'

function inputParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` }
}

function eventStatusVariant(status: string) {
  if (status === 'scheduled') return 'success' as const
  if (status === 'cancelled') return 'destructive' as const
  if (status === 'completed') return 'secondary' as const
  return 'warning' as const
}

export async function EventDetailPage({ mode, eventId, query }: { mode: 'admin' | 'staff'; eventId: string; query: { success?: string; error?: string } }) {
  await requireFeature('events', 'admin', 'staff')
  const [row] = await db.select({ event: events, accountName: customerAccounts.companyName, organizerName: users.name }).from(events).leftJoin(customerAccounts, eq(events.accountId, customerAccounts.id)).leftJoin(users, eq(events.organizerUserId, users.id)).where(eq(events.id, eventId)).limit(1)
  if (!row) notFound()
  const event = row.event
  const [participantRows, mediaRows, communicationRows, reminderRows, contactOptions, accountOptions, organizerOptions, activity] = await Promise.all([
    db.select({ participant: eventParticipants, contact: communityContacts }).from(eventParticipants).innerJoin(communityContacts, eq(eventParticipants.communityContactId, communityContacts.id)).where(eq(eventParticipants.eventId, eventId)).orderBy(asc(communityContacts.lastName), asc(communityContacts.firstName)),
    db.select().from(eventMedia).where(eq(eventMedia.eventId, eventId)).orderBy(desc(eventMedia.createdAt)),
    db.select({ communication: eventCommunications, actorName: users.name }).from(eventCommunications).leftJoin(users, eq(eventCommunications.actorUserId, users.id)).where(eq(eventCommunications.eventId, eventId)).orderBy(desc(eventCommunications.sentAt)),
    db.select().from(eventReminders).where(eq(eventReminders.eventId, eventId)).orderBy(asc(eventReminders.offsetMinutes)),
    db.select({ id: communityContacts.id, firstName: communityContacts.firstName, lastName: communityContacts.lastName, email: communityContacts.email }).from(communityContacts).orderBy(asc(communityContacts.lastName), asc(communityContacts.firstName)).limit(1000),
    db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts).orderBy(asc(customerAccounts.companyName)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    getActivityTimeline('event', eventId, [{ id: `event-created-${event.id}`, kind: 'event_created', title: 'Event created', body: null, createdAt: event.createdAt, actorName: null }]),
  ])
  const rsvpCounts = { confirmed: 0, maybe: 0, declined: 0 }
  const attendanceCounts = { checked_in: 0, no_show: 0, not_checked_in: 0 }
  let guestCount = 0
  let newContacts = 0
  for (const { participant, contact } of participantRows) {
    rsvpCounts[participant.rsvpStatus] += 1
    attendanceCounts[participant.attendanceStatus] += 1
    guestCount += participant.guestCount
    if (contact.createdAt >= event.createdAt && contact.source.startsWith('event_')) newContacts += 1
  }
  const confirmedBase = rsvpCounts.confirmed || 0
  const attendanceRate = confirmedBase ? Math.round((attendanceCounts.checked_in / confirmedBase) * 100) : 0
  const noShowRate = confirmedBase ? Math.round((attendanceCounts.no_show / confirmedBase) * 100) : 0
  const hero = mediaRows.find((media) => media.placement === 'hero' && media.approvalStatus === 'approved')
  const address = getEventAddress(event)
  const startInput = inputParts(event.startAt, event.timeZone)
  const endInput = inputParts(event.endAt, event.timeZone)
  const publicUrl = getEventPublicUrl(event.slug)
  const reminderMap = new Map(reminderRows.map((reminder) => [reminder.reminderType, reminder]))
  const rsvpStatusTotal = rsvpCounts.confirmed + rsvpCounts.maybe + rsvpCounts.declined
  const eventMetrics = [
    ['RSVPs', rsvpStatusTotal, CalendarCheck],
    ['Confirmed', rsvpCounts.confirmed, CheckCircle2],
    ['Checked in', attendanceCounts.checked_in, UsersRound],
    ['Attendance', `${attendanceRate}%`, BarChart3],
    ['No-show', `${noShowRate}%`, Activity],
    ['Media', mediaRows.length, ImageIcon],
  ] as const

  return (
    <div className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><Button asChild variant="outline" size="icon"><Link href={`/${mode}/events`} aria-label="Back to events"><ArrowLeft className="h-4 w-4" /></Link></Button><div><div className="flex flex-wrap items-center gap-2"><Badge variant={eventStatusVariant(event.status)}>{event.status}</Badge><Badge variant="outline">{event.visibility.replace('_', ' ')}</Badge><Badge variant="outline">{EVENT_TYPES.find(([value]) => value === event.eventType)?.[1]}</Badge></div><h1 className="font-display mt-2 text-3xl font-bold uppercase text-slate-950 sm:text-5xl">{event.title}</h1><p className="mt-1 text-sm text-slate-500">{formatEventDateTime(event.startAt, event.timeZone)} · {row.organizerName ?? 'Organizer unassigned'}</p></div></div><div className="flex flex-wrap gap-2">{event.visibility !== 'draft' ? <Button asChild variant="outline"><Link href={`/events/${event.slug}`} target="_blank"><ExternalLink className="h-4 w-4" />Open public page</Link></Button> : null}{event.status !== 'completed' && event.status !== 'cancelled' ? <form action={completeEvent}><input type="hidden" name="eventId" value={event.id} /><Button type="submit"><CheckCircle2 className="h-4 w-4" />Complete event</Button></form> : null}</div></header>
      {query.success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.success}</div> : null}
      {query.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {eventMetrics.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-4"><Icon className="h-4 w-4 text-[#ff5a00]" /><p className="mt-2 text-2xl font-bold">{String(value)}</p><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p></CardContent></Card>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card className="overflow-hidden"><div className="relative aspect-[16/7] bg-gradient-to-br from-[#181615] via-[#4a2517] to-[#ff5a00]">{hero ? <Image src={`/api/image?path=${encodeURIComponent(hero.storagePath)}`} alt={`${event.title} hero`} fill sizes="(max-width: 1280px) 100vw, 70vw" className="object-cover" /> : <div className="absolute inset-0 flex items-end p-7 text-white"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">Event hero</p><p className="font-display mt-2 text-4xl font-bold uppercase">Upload a hero image</p></div></div>}</div><CardContent className="space-y-5 p-6"><div><h2 className="font-display text-3xl font-bold uppercase">Event overview</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.description || 'No event description yet.'}</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Date & time</p><p className="mt-1 font-semibold">{formatEventDateTime(event.startAt, event.timeZone)}</p><p className="text-xs text-slate-500">Ends {formatEventDateTime(event.endAt, event.timeZone)} · {event.timeZone}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Location</p><p className="mt-1 font-semibold">{event.venueName || 'To be announced'}</p><p className="text-xs text-slate-500">{address}</p>{address ? <a href={getDirectionsUrl(address)} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[#ff5a00]">Get directions</a> : null}</div>{row.accountName ? <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs uppercase text-violet-500">Associated account</p><Link href={`/${mode}/crm/${event.accountId}`} className="mt-1 block font-semibold text-violet-900 hover:underline">{row.accountName}</Link><p className="text-xs text-violet-600">{event.venueContactName} · {event.venuePhone}</p></div> : null}<div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Source/channel</p><p className="mt-1 font-semibold">{event.sourceChannel || 'Not specified'}</p><p className="text-xs text-slate-500">{newContacts} new · {participantRows.length - newContacts} existing contacts</p></div></div>{address ? <iframe title={`Map for ${event.title}`} src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} className="h-72 w-full rounded-2xl border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : null}</CardContent></Card>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-[#ff5a00]" />Public page</CardTitle></CardHeader><CardContent><form action={updateEventPublishing} className="space-y-4"><input type="hidden" name="eventId" value={event.id} /><div className="space-y-2"><Label htmlFor="event-visibility">Visibility</Label><select id="event-visibility" name="visibility" defaultValue={event.visibility} className="w-full"><option value="draft">Draft · internal only</option><option value="public">Public · discoverable</option><option value="link_only">Private / link only</option><option value="closed">Closed · page visible, RSVPs closed</option></select></div><div className="space-y-2"><Label htmlFor="event-upload-policy">Attendee uploads</Label><select id="event-upload-policy" name="attendeeUploadPolicy" defaultValue={event.attendeeUploadPolicy} className="w-full"><option value="disabled">Disabled</option><option value="immediate">Appear immediately</option><option value="approval">Require approval</option><option value="private">Private/internal only</option></select></div><p className="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{publicUrl}</p><Button type="submit" className="w-full">Save public settings</Button></form></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-[#ff5a00]" />QR codes</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-center">{(['rsvp', 'upload'] as const).map((type) => <div key={type}><div className="rounded-xl border bg-white p-2"><Image src={`/api/events/${event.slug}/qr?type=${type}`} alt={`${type} QR code`} width={260} height={260} className="h-auto w-full" /></div><p className="mt-2 text-xs font-semibold uppercase">{type === 'rsvp' ? 'RSVP page' : 'Upload photos'}</p><div className="flex justify-center"><Button asChild variant="ghost" size="sm"><a href={`/api/events/${event.slug}/qr?type=${type}`} target="_blank" rel="noreferrer"><Printer className="h-3.5 w-3.5" />View / print</a></Button><Button asChild variant="ghost" size="sm"><a href={`/api/events/${event.slug}/qr?type=${type}&format=png`}><Download className="h-3.5 w-3.5" />Download</a></Button></div></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Event actions</CardTitle></CardHeader><CardContent className="space-y-2"><Button asChild variant="outline" className="w-full justify-start"><Link href={`/events/${event.slug}`}><ExternalLink className="h-4 w-4" />Preview landing page</Link></Button><Button asChild variant="outline" className="w-full justify-start"><a href={`/api/events/${event.slug}/calendar`}><CalendarDays className="h-4 w-4" />Download calendar file</a></Button>{event.status !== 'cancelled' ? <form action={cancelEvent}><input type="hidden" name="eventId" value={event.id} /><Button type="submit" variant="outline" className="w-full text-red-600">Cancel event</Button></form> : null}{mode === 'admin' ? <EventDeleteButton eventId={event.id} eventTitle={event.title} /> : null}</CardContent></Card>
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 font-semibold">Edit event details and location</summary><form action={updateEventDetails} className="grid gap-4 border-t p-5 sm:grid-cols-2"><input type="hidden" name="eventId" value={event.id} /><div className="space-y-2 sm:col-span-2"><Label htmlFor="edit-event-title">Title</Label><Input id="edit-event-title" name="title" defaultValue={event.title} required /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="edit-event-description">Description</Label><textarea id="edit-event-description" name="description" defaultValue={event.description ?? ''} className="min-h-28 w-full rounded-md border border-input px-3 py-2 text-sm" /></div><div className="space-y-2"><Label htmlFor="edit-event-type">Type</Label><select id="edit-event-type" name="eventType" defaultValue={event.eventType} className="w-full">{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="edit-event-organizer">Organizer</Label><select id="edit-event-organizer" name="organizerUserId" defaultValue={event.organizerUserId ?? ''} className="w-full"><option value="">Unassigned</option>{organizerOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div><div className="space-y-2"><Label>Start date</Label><Input name="startDate" type="date" defaultValue={startInput.date} required /></div><div className="space-y-2"><Label>Start time</Label><Input name="startTime" type="time" defaultValue={startInput.time} required /></div><div className="space-y-2"><Label>End date</Label><Input name="endDate" type="date" defaultValue={endInput.date} required /></div><div className="space-y-2"><Label>End time</Label><Input name="endTime" type="time" defaultValue={endInput.time} required /></div><div className="space-y-2"><Label>Time zone</Label><select name="timeZone" defaultValue={event.timeZone} className="w-full"><option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Los_Angeles">Pacific</option></select></div><div className="space-y-2"><Label>Location method</Label><select name="locationMode" defaultValue={event.locationMode} className="w-full"><option value="manual">Manual</option><option value="account">Existing account</option></select></div><div className="space-y-2 sm:col-span-2"><Label>CRM account (used when location method is account)</Label><select name="accountId" defaultValue={event.accountId ?? ''} className="w-full"><option value="">No account</option>{accountOptions.map((account) => <option key={account.id} value={account.id}>{account.companyName}</option>)}</select></div><div className="space-y-2 sm:col-span-2"><Label>Venue</Label><Input name="venueName" defaultValue={event.venueName ?? ''} /></div><div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input name="addressLine1" defaultValue={event.addressLine1 ?? ''} /></div><div className="space-y-2 sm:col-span-2"><Label>Address line 2</Label><Input name="addressLine2" defaultValue={event.addressLine2 ?? ''} /></div><div className="space-y-2"><Label>City</Label><Input name="city" defaultValue={event.city ?? ''} /></div><div className="space-y-2"><Label>State</Label><Input name="state" defaultValue={event.state ?? ''} /></div><div className="space-y-2"><Label>ZIP</Label><Input name="postalCode" defaultValue={event.postalCode ?? ''} /></div><div className="space-y-2"><Label>Country</Label><Input name="country" defaultValue={event.country} /></div><div className="space-y-2 sm:col-span-2"><Label>Source/channel</Label><Input name="sourceChannel" defaultValue={event.sourceChannel ?? ''} /></div><div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Public RSVP optional fields</p><div className="grid gap-2 sm:grid-cols-3">{RSVP_OPTIONAL_FIELDS.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" name="rsvpOptionalFields" value={value} defaultChecked={event.rsvpOptionalFields.includes(value)} />{label}</label>)}</div></div><Button type="submit" className="sm:col-span-2">Save event details</Button></form></details>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-[#ff5a00]" />RSVPs and attendees</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {participantRows.length ? participantRows.map(({ participant, contact }) => (
              <form key={participant.id} action={updateEventParticipant} className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(12rem,1fr)_10rem_12rem_minmax(10rem,1fr)_auto]">
                <input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="participantId" value={participant.id} />
                <div>{mode === 'admin' ? <Link href={`/admin/crm/community/${contact.id}`} className="font-semibold text-slate-950 hover:text-[#ff5a00] hover:underline">{contact.firstName} {contact.lastName}</Link> : <p className="font-semibold text-slate-950">{contact.firstName} {contact.lastName}</p>}<p className="text-xs text-slate-500">{contact.email} · {contact.phone}</p><p className="mt-1 text-xs capitalize text-slate-400">{participant.source.replace('_', ' ')}{participant.guestCount ? ` · +${participant.guestCount} guests` : ''}</p></div>
                <select name="rsvpStatus" defaultValue={participant.rsvpStatus}><option value="confirmed">Confirmed</option><option value="maybe">Maybe</option><option value="declined">Declined</option></select>
                <select name="attendanceStatus" defaultValue={participant.attendanceStatus}><option value="not_checked_in">Not checked in</option><option value="checked_in">Checked in</option><option value="no_show">No-show</option></select>
                <Input name="notes" defaultValue={participant.notes ?? ''} placeholder="Attendee note" />
                <div className="flex gap-1"><Button type="submit" size="sm">Save</Button><Button formAction={removeEventParticipant} type="submit" name="participantId" value={participant.id} size="sm" variant="ghost" className="text-red-600">Remove</Button></div>
              </form>
            )) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No RSVPs or attendees yet.</p>}
          </CardContent>
        </Card>
        <div className="space-y-6"><Card><CardHeader><CardTitle>Add existing contact</CardTitle></CardHeader><CardContent><form action={addExistingEventAttendee} className="space-y-3"><input type="hidden" name="eventId" value={event.id} /><select name="contactId" required className="w-full"><option value="">Search/select Community Contact</option>{contactOptions.map((contact) => <option key={contact.id} value={contact.id}>{contact.lastName}, {contact.firstName} · {contact.email}</option>)}</select><Input name="notes" placeholder="Optional attendee note" /><Button type="submit" className="w-full">Add attendee</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Create or match contact</CardTitle></CardHeader><CardContent><form action={addNewEventAttendee} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="eventId" value={event.id} /><Input name="firstName" placeholder="First name" required /><Input name="lastName" placeholder="Last name" required /><Input name="email" type="email" placeholder="Email" required /><Input name="phone" type="tel" placeholder="Mobile phone" required /><Input name="notes" placeholder="Optional note" className="sm:col-span-2" /><Button type="submit" className="sm:col-span-2">Create/match and add</Button></form></CardContent></Card><EventCsvImport eventId={event.id} /></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-[#ff5a00]" />Media manager</CardTitle></CardHeader><CardContent><EventMediaUploader eventId={event.id} /></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Media library and moderation</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {mediaRows.length ? mediaRows.map((media) => (
              <div key={media.id} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="relative aspect-video bg-slate-100">{media.mediaType === 'image' ? <Image src={`/api/image?path=${encodeURIComponent(media.storagePath)}`} alt={media.caption || media.fileName} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" /> : media.mediaType === 'video' ? <video src={`/api/image?path=${encodeURIComponent(media.storagePath)}`} controls className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">{media.fileName}</div>}</div>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-1"><Badge variant="outline">{media.placement}</Badge><Badge variant={media.approvalStatus === 'approved' ? 'success' : media.approvalStatus === 'rejected' ? 'destructive' : 'warning'}>{media.approvalStatus}</Badge><Badge variant="secondary">{media.uploadSource}</Badge>{media.featured ? <Badge variant="success">Featured</Badge> : null}</div>
                  <p className="truncate text-xs text-slate-500">{media.fileName}</p>
                  <Button asChild variant="outline" size="sm" className="w-full"><a href={`/api/image?path=${encodeURIComponent(media.storagePath)}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />View / download</a></Button>
                  <form action={moderateEventMedia} className="grid grid-cols-[1fr_auto] gap-2">
                    <input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="mediaId" value={media.id} />
                    <select name="approvalStatus" defaultValue={media.approvalStatus} className="min-w-0"><option value="approved">Approve</option><option value="rejected">Reject</option><option value="private">Private</option></select>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="featured" value="true" defaultChecked={media.featured} />Featured</label>
                    <Button type="submit" size="sm" className="col-span-2">Save moderation</Button>
                  </form>
                  <form action={removeEventMedia}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="mediaId" value={media.id} /><Button type="submit" variant="ghost" size="sm" className="w-full text-red-600">Delete</Button></form>
                </div>
              </div>
            )) : <p className="sm:col-span-2 text-sm text-slate-500">No event media yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div id="event-messages" className="grid scroll-mt-6 gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-[#ff5a00]" />Send message</CardTitle></CardHeader><CardContent><form action={sendEventCommunication} className="space-y-4"><input type="hidden" name="eventId" value={event.id} /><div className="grid gap-3 sm:grid-cols-3"><div className="space-y-2"><Label>Channel</Label><select name="channel" defaultValue="email" className="w-full"><option value="email">Email</option><option value="sms">SMS</option></select></div><div className="space-y-2"><Label>Audience</Label><select name="audience" defaultValue="confirmed" className="w-full"><option value="everyone">Everyone except declined</option><option value="confirmed">Confirmed RSVPs</option><option value="checked_in">Checked-in attendees</option><option value="no_show">No-shows</option><option value="not_checked_in">Not checked in</option><option value="selected">Selected individuals</option></select></div><div className="space-y-2"><Label>Message type</Label><select name="messageType" defaultValue="reminder" className="w-full"><option value="confirmation">Confirmation</option><option value="reminder">Reminder</option><option value="event_update">Event update</option><option value="location_change">Location change</option><option value="starting_soon">Starting soon</option><option value="thank_you">Thank you</option><option value="custom">Custom</option></select></div></div><div className="space-y-2"><Label>Subject (email)</Label><Input name="subject" defaultValue={`Update for ${event.title}`} /></div><div className="space-y-2"><Label>Message</Label><textarea name="body" required className="min-h-32 w-full rounded-md border border-input px-3 py-2 text-sm" /></div><details><summary className="cursor-pointer text-sm font-medium">Select individuals</summary><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{participantRows.map(({ participant, contact }) => <label key={participant.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="selectedParticipantId" value={participant.id} />{contact.firstName} {contact.lastName}</label>)}</div></details><p className="text-xs text-slate-500">Email and SMS are only sent where the contact’s consent/preferences allow.</p><Button type="submit"><Send className="h-4 w-4" />Send message</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-[#ff5a00]" />Automated reminders</CardTitle></CardHeader><CardContent><form action={saveEventReminders} className="space-y-3"><input type="hidden" name="eventId" value={event.id} />{([['seven_days', '7 days before'], ['twenty_four_hours', '24 hours before'], ['two_hours', '2 hours before'], ['thank_you', 'Post-event thank you']] as const).map(([type, label]) => { const reminder = reminderMap.get(type); return <div key={type} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border p-3"><span className="text-sm font-medium">{label}</span><label className="text-xs"><input type="checkbox" name={`email_${type}`} defaultChecked={reminder?.channels.includes('email')} /> Email</label><label className="text-xs"><input type="checkbox" name={`sms_${type}`} defaultChecked={reminder?.channels.includes('sms')} /> SMS</label><label className="text-xs font-semibold"><input type="checkbox" name={`enabled_${type}`} defaultChecked={reminder?.enabled} /> On</label></div> })}<Button type="submit" className="w-full">Save reminder schedule</Button></form><div className="mt-6 border-t pt-4"><h3 className="text-sm font-semibold">Communication history</h3><div className="mt-3 space-y-2">{communicationRows.slice(0, 8).map(({ communication, actorName }) => <div key={communication.id} className="rounded-lg bg-slate-50 p-3 text-xs"><div className="flex items-center justify-between"><span className="font-semibold uppercase">{communication.channel} · {communication.messageType.replace('_', ' ')}</span><span className="text-slate-400">{communication.sentAt.toLocaleDateString()}</span></div><p className="mt-1 text-slate-600">{communication.sentCount}/{communication.recipientCount} sent{communication.failedCount ? ` · ${communication.failedCount} failed` : ''}{actorName ? ` · ${actorName}` : ''}</p></div>)}{!communicationRows.length ? <p className="text-sm text-slate-500">No event messages sent yet.</p> : null}</div></div></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#ff5a00]" />Event reporting</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Contact generation</p><p className="mt-2 text-2xl font-bold">{newContacts}</p><p className="text-xs text-slate-500">new · {participantRows.length - newContacts} existing</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Guest RSVPs</p><p className="mt-2 text-2xl font-bold">{guestCount}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Email sends</p><p className="mt-2 text-2xl font-bold">{communicationRows.filter(({ communication }) => communication.channel === 'email').reduce((sum, { communication }) => sum + communication.sentCount, 0)}</p><p className="text-xs text-slate-500">Open/click tracking not connected</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">SMS sends</p><p className="mt-2 text-2xl font-bold">{communicationRows.filter(({ communication }) => communication.channel === 'sms').reduce((sum, { communication }) => sum + communication.sentCount, 0)}</p><p className="text-xs text-slate-500">Delivery engagement not attributed</p></div></CardContent></Card>

      {event.status === 'completed' ? <Card className="border-emerald-200 bg-emerald-50"><CardHeader><CardTitle>Event completion summary</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-5">{[['RSVPs', rsvpCounts.confirmed], ['Attendees', attendanceCounts.checked_in], ['No-shows', attendanceCounts.no_show], ['New contacts', newContacts], ['Media', mediaRows.length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white p-4 text-center"><p className="text-2xl font-bold">{String(value)}</p><p className="text-xs uppercase text-slate-400">{String(label)}</p></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/${mode}/tasks?account=${event.accountId ?? ''}`}>Add follow-up task</Link></Button><Button asChild variant="outline"><Link href={`/${mode}/tastings${event.accountId ? `?account=${event.accountId}` : ''}`}>Schedule tasting</Link></Button><Button asChild variant="outline"><a href="#event-messages">Send thank-you</a></Button><Button asChild variant="outline"><Link href={`/${mode}/events`}>Create another event</Link></Button></div></CardContent></Card> : null}
      <ActivityTimeline title="Event timeline" items={activity} />
    </div>
  )
}
