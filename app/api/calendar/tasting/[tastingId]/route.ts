import { NextResponse } from 'next/server'
import { getTastingById } from '@/lib/tastings/read'
import { buildIcsFile } from '@/lib/calendar'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tastingId: string }> }
) {
  const { tastingId } = await params
  const tasting = await getTastingById(tastingId)

  if (!tasting) {
    return new NextResponse('Not found', { status: 404 })
  }

  const start = new Date(tasting.scheduledAt)
  const end = tasting.endAt ? new Date(tasting.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const location = [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ')
  const ics = buildIcsFile({
    title: `AHAWC Tasting - ${tasting.eventName}`,
    description: tasting.notes ?? 'AHAWC tasting assignment',
    location,
    start,
    end,
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="tasting-${tastingId}.ics"`,
    },
  })
}
