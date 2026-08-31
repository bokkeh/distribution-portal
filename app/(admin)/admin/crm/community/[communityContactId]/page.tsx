import Link from 'next/link'
import { desc, eq, or } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Mail, MapPin, MessageSquare, NotebookPen, UserRound } from 'lucide-react'
import {
  addCommunityContactNote,
  addCommunityEventAttendance,
  removeCommunityEventAttendance,
  sendCommunityContactCommunication,
  updateCommunityContactProfile,
} from '@/actions/community-contacts'
import { ActivityTimeline } from '@/components/activity/ActivityTimeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db } from '@/db'
import {
  communityContactCommunications,
  communityContactNotes,
  communityContacts,
  communityEventAttendance,
  smsMessages,
  tastings,
  users,
} from '@/db/schema'
import { getActivityTimeline } from '@/lib/activity/read'
import { requireFeature } from '@/lib/auth/session'
import { normalizePhone } from '@/lib/telnyx/compliance'
import { formatDate, formatPhone } from '@/lib/utils'

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function contactName(contact: { firstName: string; lastName: string }) {
  return `${contact.firstName} ${contact.lastName}`.trim()
}

export default async function CommunityContactProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ communityContactId: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  await requireFeature('crm', 'admin')
  const { communityContactId } = await params
  const query = await searchParams

  const [contact] = await db.select().from(communityContacts).where(eq(communityContacts.id, communityContactId)).limit(1)
  if (!contact) notFound()

  let normalizedPhone = contact.phone
  try {
    normalizedPhone = normalizePhone(contact.phone)
  } catch {
    // Retain the stored value so legacy numbers can still match older message rows.
  }

  const [notes, attendance, emailHistory, smsHistory, eventOptions, activity] = await Promise.all([
    db.select({
      id: communityContactNotes.id,
      body: communityContactNotes.body,
      createdAt: communityContactNotes.createdAt,
      authorName: users.name,
    }).from(communityContactNotes)
      .leftJoin(users, eq(communityContactNotes.authorUserId, users.id))
      .where(eq(communityContactNotes.communityContactId, communityContactId))
      .orderBy(desc(communityContactNotes.createdAt)),
    db.select({
      id: communityEventAttendance.id,
      attendedAt: communityEventAttendance.attendedAt,
      notes: communityEventAttendance.notes,
      tastingId: tastings.id,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      city: tastings.storeCity,
      state: tastings.storeState,
    }).from(communityEventAttendance)
      .innerJoin(tastings, eq(communityEventAttendance.tastingId, tastings.id))
      .where(eq(communityEventAttendance.communityContactId, communityContactId))
      .orderBy(desc(communityEventAttendance.attendedAt)),
    db.select({
      id: communityContactCommunications.id,
      channel: communityContactCommunications.channel,
      direction: communityContactCommunications.direction,
      subject: communityContactCommunications.subject,
      body: communityContactCommunications.body,
      status: communityContactCommunications.status,
      occurredAt: communityContactCommunications.occurredAt,
      actorName: users.name,
    }).from(communityContactCommunications)
      .leftJoin(users, eq(communityContactCommunications.actorUserId, users.id))
      .where(eq(communityContactCommunications.communityContactId, communityContactId))
      .orderBy(desc(communityContactCommunications.occurredAt)),
    db.select({
      id: smsMessages.id,
      direction: smsMessages.direction,
      body: smsMessages.body,
      status: smsMessages.status,
      occurredAt: smsMessages.createdAt,
      actorName: users.name,
    }).from(smsMessages)
      .leftJoin(users, eq(smsMessages.userId, users.id))
      .where(or(eq(smsMessages.phoneNumber, normalizedPhone), eq(smsMessages.phoneNumber, contact.phone)))
      .orderBy(desc(smsMessages.createdAt))
      .limit(200),
    db.select({ id: tastings.id, eventName: tastings.eventName, scheduledAt: tastings.scheduledAt, city: tastings.storeCity, state: tastings.storeState })
      .from(tastings)
      .orderBy(desc(tastings.scheduledAt))
      .limit(250),
    getActivityTimeline('community_contact', communityContactId, [{
      id: `community-contact-created-${communityContactId}`,
      kind: 'community_contact_created',
      title: 'Community contact created',
      body: `Joined through ${contact.source.replaceAll('_', ' ')}.`,
      createdAt: contact.createdAt,
      actorName: null,
    }]),
  ])

  const communications = [
    ...emailHistory.map((item) => ({ ...item, channel: 'email' as const })),
    ...smsHistory.map((item) => ({ ...item, channel: 'sms' as const, subject: null })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

  const fullName = contactName(contact)
  const address = [contact.addressLine1, contact.addressLine2, contact.city, contact.state, contact.postalCode, contact.country].filter(Boolean).join(', ')

  return (
    <div className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon"><Link href="/admin/crm?tab=community-contacts" aria-label="Back to community contacts"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-bold uppercase text-slate-950 sm:text-4xl">{fullName}</h1>
              <Badge variant={contact.status === 'subscribed' ? 'success' : 'outline'}>{contact.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">Community contact · Joined {formatDate(contact.createdAt)}</p>
          </div>
        </div>
      </div>

      {query.success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.success}</div> : null}
      {query.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card className="shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-[#ff5a00]" />Profile and location</CardTitle></CardHeader>
          <CardContent>
            <form action={updateCommunityContactProfile} className="space-y-4">
              <input type="hidden" name="contactId" value={contact.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" defaultValue={contact.firstName} required /></div>
                <div className="space-y-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" defaultValue={contact.lastName} required /></div>
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={contact.email} required /></div>
                <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" defaultValue={contact.phone} required /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="addressLine1">Address</Label><Input id="addressLine1" name="addressLine1" defaultValue={contact.addressLine1 ?? ''} autoComplete="street-address" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="addressLine2">Address line 2</Label><Input id="addressLine2" name="addressLine2" defaultValue={contact.addressLine2 ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" name="city" defaultValue={contact.city ?? ''} autoComplete="address-level2" /></div>
                <div className="space-y-2"><Label htmlFor="state">State/region</Label><Input id="state" name="state" defaultValue={contact.state ?? ''} autoComplete="address-level1" /></div>
                <div className="space-y-2"><Label htmlFor="postalCode">Postal code</Label><Input id="postalCode" name="postalCode" defaultValue={contact.postalCode ?? ''} autoComplete="postal-code" /></div>
                <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" name="country" defaultValue={contact.country} autoComplete="country-name" /></div>
                <div className="space-y-2"><Label htmlFor="status">Marketing status</Label><select id="status" name="status" defaultValue={contact.status} className="w-full"><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option></select></div>
              </div>
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#ff5a00]" />Contact summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Email</p><a href={`mailto:${contact.email}`} className="font-medium text-slate-900 hover:text-[#ff5a00] hover:underline">{contact.email}</a></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Phone</p><a href={`tel:${contact.phone}`} className="font-medium text-slate-900 hover:text-[#ff5a00] hover:underline">{formatPhone(contact.phone) ?? contact.phone}</a></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Location</p><p className="font-medium text-slate-900">{address || 'No address entered'}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Source</p><p className="font-medium capitalize text-slate-900">{contact.source.replaceAll('_', ' ')}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Events attended</p><p className="font-medium text-slate-900">{attendance.length}</p></div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader><CardTitle className="flex items-center gap-2"><NotebookPen className="h-5 w-5 text-[#ff5a00]" />Add note</CardTitle></CardHeader>
            <CardContent>
              <form action={addCommunityContactNote} className="space-y-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <textarea name="body" required maxLength={5000} className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" placeholder="Add context, preferences, follow-up details, or personal notes…" />
                <Button type="submit" className="w-full">Save note</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#ff5a00]" />Events attended</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form action={addCommunityEventAttendance} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input type="hidden" name="contactId" value={contact.id} />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select name="tastingId" required className="w-full bg-white" defaultValue=""><option value="" disabled>Select an event</option>{eventOptions.map((event) => <option key={event.id} value={event.id}>{formatDate(event.scheduledAt)} · {event.eventName}{event.city || event.state ? ` · ${[event.city, event.state].filter(Boolean).join(', ')}` : ''}</option>)}</select>
                <Button type="submit">Record attendance</Button>
              </div>
              <Input name="notes" className="mt-3 bg-white" placeholder="Optional attendance note" />
            </form>
            {attendance.length ? attendance.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-900">{item.eventName}</p><p className="mt-1 text-xs text-slate-500">Attended {formatDate(item.attendedAt)} · {[item.city, item.state].filter(Boolean).join(', ') || 'Location not entered'}</p>{item.notes ? <p className="mt-2 text-sm text-slate-600">{item.notes}</p> : null}</div>
                  <form action={removeCommunityEventAttendance}><input type="hidden" name="contactId" value={contact.id} /><input type="hidden" name="attendanceId" value={item.id} /><Button type="submit" variant="ghost" size="sm" className="text-red-600">Remove</Button></form>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No event attendance recorded yet.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-[#ff5a00]" />Send SMS or email</CardTitle></CardHeader>
          <CardContent>
            <form action={sendCommunityContactCommunication} className="space-y-3">
              <input type="hidden" name="contactId" value={contact.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="channel">Channel</Label><select id="channel" name="channel" defaultValue="sms" className="w-full"><option value="sms">SMS · {formatPhone(contact.phone) ?? contact.phone}</option><option value="email">Email · {contact.email}</option></select></div>
                <div className="space-y-2"><Label htmlFor="subject">Email subject</Label><Input id="subject" name="subject" placeholder="Required for email" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="messageBody">Message</Label><textarea id="messageBody" name="body" required maxLength={5000} className="min-h-32 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /></div>
              <Button type="submit"><Mail className="h-4 w-4" />Send message</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader><CardTitle>Communication history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {communications.length ? communications.map((item) => (
              <div key={`${item.channel}-${item.id}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="outline">{item.channel}</Badge><Badge variant={item.status === 'sent' || item.status === 'received' ? 'success' : 'destructive'}>{item.status}</Badge><span className="text-xs capitalize text-slate-500">{item.direction}</span></div><span className="text-xs text-slate-400">{formatDateTime(item.occurredAt)}</span></div>
                {item.subject ? <p className="mt-3 text-sm font-semibold text-slate-900">{item.subject}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>
                {item.actorName ? <p className="mt-2 text-xs text-slate-400">By {item.actorName}</p> : null}
              </div>
            )) : <p className="text-sm text-slate-500">No SMS or email history found for this contact.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader><CardTitle>Person notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notes.length ? notes.map((note) => <div key={note.id} className="rounded-xl border border-slate-200 p-4"><p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p><p className="mt-2 text-xs text-slate-400">{note.authorName ? `By ${note.authorName} · ` : ''}{formatDateTime(note.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No notes added yet.</p>}
          </CardContent>
        </Card>
      </div>

      <ActivityTimeline items={activity} title="Community contact activity" />
    </div>
  )
}
