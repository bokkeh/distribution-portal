import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/db'
import { events } from '@/db/schema'
import { getEventPublicUrl } from '@/lib/events/utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [event] = await db.select({ slug: events.slug, visibility: events.visibility }).from(events).where(eq(events.slug, slug)).limit(1)
  if (!event || event.visibility === 'draft') return new NextResponse('Not found', { status: 404 })
  const type = request.nextUrl.searchParams.get('type') === 'upload' ? 'upload' : 'rsvp'
  const target = `${getEventPublicUrl(event.slug)}${type === 'upload' ? '/upload' : ''}`
  const format = request.nextUrl.searchParams.get('format')
  if (format === 'png') {
    const png = await QRCode.toBuffer(target, { width: 1200, margin: 2, color: { dark: '#181615', light: '#ffffff' } })
    return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${event.slug}-${type}-qr.png"` } })
  }
  const svg = await QRCode.toString(target, { type: 'svg', width: 640, margin: 2, color: { dark: '#181615', light: '#ffffff' } })
  return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
