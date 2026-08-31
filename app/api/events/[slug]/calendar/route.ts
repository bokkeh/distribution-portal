import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { events } from '@/db/schema'
import { getEventAddress } from '@/lib/events/utils'

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1)
  if (!event || event.visibility === 'draft') return new NextResponse('Not found', { status: 404 })
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AHAWC//Events//EN', 'BEGIN:VEVENT', `UID:${event.id}@ahawc.com`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(event.startAt)}`, `DTEND:${icsDate(event.endAt)}`, `SUMMARY:${escapeIcs(event.title)}`, `DESCRIPTION:${escapeIcs(event.description ?? '')}`, `LOCATION:${escapeIcs(getEventAddress(event))}`, `URL:https://ahawc.com/events/${event.slug}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${event.slug}.ics"` } })
}
