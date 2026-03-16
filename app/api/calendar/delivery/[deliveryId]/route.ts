import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { deliveries } from '@/db/schema'
import { buildIcsFile } from '@/lib/calendar'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  const { deliveryId } = await params
  const [delivery] = await db
    .select({ id: deliveries.id, weekStartDate: deliveries.weekStartDate, status: deliveries.status })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .limit(1)

  if (!delivery) {
    return new NextResponse('Not found', { status: 404 })
  }

  const start = new Date(`${delivery.weekStartDate}T08:00:00-05:00`)
  const end = new Date(`${delivery.weekStartDate}T18:00:00-05:00`)
  const ics = buildIcsFile({
    title: `AHAWC Delivery Run - ${delivery.weekStartDate}`,
    description: `Driver delivery run scheduled for ${delivery.weekStartDate}.`,
    start,
    end,
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="delivery-${deliveryId}.ics"`,
    },
  })
}
