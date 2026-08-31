import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CalendarDays, Camera, Clock, MapPin, Navigation, UserRound } from 'lucide-react'
import { db } from '@/db'
import { eventMedia, events, users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PublicEventRsvpForm } from '@/components/events/PublicEventRsvpForm'
import { formatEventDateTime, getDirectionsUrl, getEventAddress } from '@/lib/events/utils'

async function getPublicEvent(slug: string) {
  const [row] = await db.select({ event: events, organizerName: users.name }).from(events).leftJoin(users, eq(events.organizerUserId, users.id)).where(eq(events.slug, slug)).limit(1)
  if (!row || row.event.visibility === 'draft') return null
  return row
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const row = await getPublicEvent(slug)
  if (!row) return { title: 'Event not found | AHAWC' }
  const [hero] = await db.select({ storagePath: eventMedia.storagePath }).from(eventMedia).where(and(eq(eventMedia.eventId, row.event.id), eq(eventMedia.placement, 'hero'), eq(eventMedia.approvalStatus, 'approved'))).limit(1)
  return { title: `${row.event.title} | AHAWC`, description: row.event.description ?? `Join us for ${row.event.title}.`, openGraph: { title: row.event.title, description: row.event.description ?? undefined, images: hero ? [`/api/image?path=${encodeURIComponent(hero.storagePath)}`] : undefined } }
}

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const row = await getPublicEvent(slug)
  if (!row) notFound()
  const event = row.event
  const media = await db.select().from(eventMedia).where(and(eq(eventMedia.eventId, event.id), eq(eventMedia.approvalStatus, 'approved'), inArray(eventMedia.placement, ['hero', 'gallery', 'promotional', 'attachment']))).orderBy(asc(eventMedia.createdAt))
  const hero = media.find((item) => item.placement === 'hero')
  const gallery = media.filter((item) => item.placement === 'gallery' && ['image', 'video'].includes(item.mediaType))
  const promotional = media.filter((item) => item.placement === 'promotional')
  const attachments = media.filter((item) => item.placement === 'attachment')
  const address = getEventAddress(event)
  const rsvpOpen = ['public', 'link_only'].includes(event.visibility) && event.status === 'scheduled'
  return (
    <main className="min-h-screen bg-[#f4f1ed] text-[#181615]">
      <section className="relative min-h-[68vh] overflow-hidden bg-[#181615] text-white">{hero ? <Image src={`/api/image?path=${encodeURIComponent(hero.storagePath)}`} alt={event.title} fill priority sizes="100vw" className="object-cover opacity-65" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#ff5a00,transparent_45%),linear-gradient(135deg,#181615,#4a2517)]" />}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/25" /><div className="relative mx-auto flex min-h-[68vh] max-w-6xl items-end px-5 py-12 sm:px-8 sm:py-16"><div className="max-w-4xl"><Badge className="bg-[#ff5a00] text-white hover:bg-[#ff5a00]">AHAWC Community Event</Badge><h1 className="font-display mt-5 text-5xl font-black uppercase leading-[0.9] sm:text-7xl lg:text-8xl">{event.title}</h1><div className="mt-7 grid gap-3 text-base sm:grid-cols-2 sm:text-lg"><p className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#ff8a4c]" />{new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: event.timeZone }).format(event.startAt)}</p><p className="flex items-center gap-3"><Clock className="h-5 w-5 text-[#ff8a4c]" />{new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: event.timeZone }).format(event.startAt)} – {new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: event.timeZone }).format(event.endAt)}</p><p className="flex items-center gap-3 sm:col-span-2"><MapPin className="h-5 w-5 text-[#ff8a4c]" />{event.venueName || address || 'Location to be announced'}</p></div><div className="mt-8 flex flex-wrap gap-3">{rsvpOpen ? <Button asChild size="lg" className="h-12 bg-[#ff5a00] px-7 font-display text-lg uppercase hover:bg-[#e65000]"><a href="#rsvp">RSVP now</a></Button> : <Badge variant="secondary" className="px-5 py-3 text-sm">RSVPs are closed</Badge>}{address ? <Button asChild size="lg" variant="outline" className="h-12 border-white/40 bg-white/10 text-white hover:bg-white hover:text-black"><a href={getDirectionsUrl(address)} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" />Get directions</a></Button> : null}</div></div></div></section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:py-20"><div className="space-y-10"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff5a00]">About the event</p><h2 className="font-display mt-2 text-4xl font-bold uppercase">Come build community with us</h2><p className="mt-5 whitespace-pre-wrap text-lg leading-8 text-slate-600">{event.description || 'More event details are coming soon.'}</p></div>{promotional.length ? <div className="grid gap-4 sm:grid-cols-2">{promotional.map((item) => <div key={item.id} className="relative aspect-[4/5] overflow-hidden rounded-3xl">{item.mediaType === 'image' ? <Image src={`/api/image?path=${encodeURIComponent(item.storagePath)}`} alt={item.caption || item.fileName} fill sizes="(max-width: 640px) 100vw, 40vw" className="object-cover" /> : null}</div>)}</div> : null}{gallery.length ? <div><h2 className="font-display text-3xl font-bold uppercase">Event gallery</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{gallery.map((item) => <div key={item.id} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">{item.mediaType === 'image' ? <Image src={`/api/image?path=${encodeURIComponent(item.storagePath)}`} alt={item.caption || item.fileName} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" /> : <video src={`/api/image?path=${encodeURIComponent(item.storagePath)}`} controls className="h-full w-full object-cover" />}</div>)}</div></div> : null}{attachments.length ? <div><h2 className="font-display text-3xl font-bold uppercase">Downloads</h2><div className="mt-4 space-y-2">{attachments.map((item) => <a key={item.id} href={`/api/image?path=${encodeURIComponent(item.storagePath)}`} className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 font-medium hover:border-[#ff5a00]">{item.caption || item.fileName}<span className="text-[#ff5a00]">Download</span></a>)}</div></div> : null}</div>
        <aside className="space-y-6"><Card className="sticky top-5 overflow-hidden border-0 shadow-xl"><CardContent className="p-0"><div className="bg-[#181615] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ff8a4c]">Event details</p><h2 className="font-display mt-2 text-3xl font-bold uppercase">{event.venueName || 'Venue TBA'}</h2></div><div className="space-y-5 p-6"><div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 text-[#ff5a00]" /><div><p className="font-semibold">{formatEventDateTime(event.startAt, event.timeZone)}</p><p className="text-sm text-slate-500">Ends {new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: event.timeZone }).format(event.endAt)}</p></div></div><div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 text-[#ff5a00]" /><div><p className="font-semibold">{event.venueName}</p><p className="text-sm text-slate-500">{[event.addressLine1, event.addressLine2, event.city, event.state, event.postalCode].filter(Boolean).join(', ')}</p></div></div>{row.organizerName ? <div className="flex gap-3"><UserRound className="mt-0.5 h-5 w-5 text-[#ff5a00]" /><div><p className="text-xs uppercase text-slate-400">Hosted by</p><p className="font-semibold">{row.organizerName}</p></div></div> : null}{address ? <iframe title={`Map to ${event.title}`} src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} className="h-56 w-full rounded-xl border-0" loading="lazy" /> : null}{event.attendeeUploadPolicy !== 'disabled' ? <Button asChild variant="outline" className="w-full"><Link href={`/events/${event.slug}/upload`}><Camera className="h-4 w-4" />Share event photos</Link></Button> : null}</div></CardContent></Card></aside></section>
      {rsvpOpen ? <section id="rsvp" className="bg-white px-5 py-14 sm:px-8"><div className="mx-auto max-w-2xl"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff5a00]">Save your spot</p><h2 className="font-display mt-2 text-4xl font-bold uppercase sm:text-5xl">RSVP for {event.title}</h2><p className="mt-3 text-slate-500">We’ll send confirmation, directions, and a calendar link immediately.</p></div><div className="mt-8 rounded-3xl border border-slate-200 bg-[#f8f6f2] p-5 sm:p-8"><PublicEventRsvpForm slug={event.slug} optionalFields={event.rsvpOptionalFields} /></div></div></section> : null}
    </main>
  )
}
