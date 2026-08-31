import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { db } from '@/db'
import { communityContacts, eventParticipants, events } from '@/db/schema'
import { PublicRsvpManager } from '@/components/events/PublicRsvpManager'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatEventDateTime, getEventAddress } from '@/lib/events/utils'

export default async function EventRsvpManagementPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const [row] = await db.select({ event: events, participant: eventParticipants, contact: communityContacts }).from(eventParticipants).innerJoin(events, eq(eventParticipants.eventId, events.id)).innerJoin(communityContacts, eq(eventParticipants.communityContactId, communityContacts.id)).where(and(eq(events.slug, slug), eq(eventParticipants.managementToken, token))).limit(1)
  if (!row || row.event.visibility === 'draft') notFound()
  return <main className="min-h-screen bg-[#f4f1ed] px-4 py-10"><div className="mx-auto max-w-lg"><Button asChild variant="ghost" className="mb-5"><Link href={`/events/${slug}`}><ArrowLeft className="h-4 w-4" />Back to event</Link></Button><Card><CardContent className="p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff5a00]">Manage RSVP</p><h1 className="font-display mt-2 text-4xl font-bold uppercase">{row.event.title}</h1><p className="mt-2 text-slate-600">Hi {row.contact.firstName}, update your response below.</p><div className="my-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm"><p className="flex gap-2"><CalendarDays className="h-4 w-4 text-[#ff5a00]" />{formatEventDateTime(row.event.startAt, row.event.timeZone)}</p><p className="flex gap-2"><MapPin className="h-4 w-4 text-[#ff5a00]" />{getEventAddress(row.event)}</p></div><PublicRsvpManager slug={slug} token={token} currentStatus={row.participant.rsvpStatus} /></CardContent></Card></div></main>
}
