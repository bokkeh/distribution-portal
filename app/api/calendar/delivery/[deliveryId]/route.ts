import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/db'
import { deliveries, drivers } from '@/db/schema'
import { buildIcsFile } from '@/lib/calendar'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : [])

  const { deliveryId } = await params
  const [delivery] = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      driverId: deliveries.driverId,
    })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .limit(1)

  if (!delivery) {
    return new NextResponse('Not found', { status: 404 })
  }

  const isAdminOrStaff = roles.some((role) => role === 'admin' || role === 'staff')
  if (!isAdminOrStaff) {
    if (!roles.includes('driver')) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const [driver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, session.user.id))
      .limit(1)

    if (!driver || driver.id !== delivery.driverId) {
      return new NextResponse('Forbidden', { status: 403 })
    }
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
