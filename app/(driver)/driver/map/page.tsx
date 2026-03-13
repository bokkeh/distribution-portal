import { db } from '@/db'
import { deliveries, deliveryStops, drivers, customerAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DriverMapPage() {
  const session = await requireRole('driver', 'admin')

  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.user.id))

  let stops: Array<{
    id: string
    sequenceNumber: number
    address: string
    contactName: string | null
    contactPhone: string | null
    lat: string | null
    lng: string | null
    status: 'pending' | 'delivered' | 'failed'
    companyName: string | null
  }> = []

  if (driver) {
    try {
      stops = await db
        .select({
          id: deliveryStops.id,
          sequenceNumber: deliveryStops.sequenceNumber,
          address: deliveryStops.address,
          contactName: deliveryStops.contactName,
          contactPhone: deliveryStops.contactPhone,
          lat: deliveryStops.lat,
          lng: deliveryStops.lng,
          status: deliveryStops.status,
          companyName: customerAccounts.companyName,
        })
        .from(deliveries)
        .innerJoin(deliveryStops, eq(deliveryStops.deliveryId, deliveries.id))
        .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
        .where(eq(deliveries.driverId, driver.id))
        .orderBy(deliveryStops.sequenceNumber)
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
        ?? (error as { cause?: { code?: string } } | null)?.cause?.code
      const message = error instanceof Error ? error.message.toLowerCase() : ''

      if (code !== '42703' && !message.includes('contact_name') && !message.includes('contact_phone')) {
        throw error
      }

      stops = await db
        .select({
          id: deliveryStops.id,
          sequenceNumber: deliveryStops.sequenceNumber,
          address: deliveryStops.address,
          lat: deliveryStops.lat,
          lng: deliveryStops.lng,
          status: deliveryStops.status,
          companyName: customerAccounts.companyName,
        })
        .from(deliveries)
        .innerJoin(deliveryStops, eq(deliveryStops.deliveryId, deliveries.id))
        .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
        .where(eq(deliveries.driverId, driver.id))
        .orderBy(deliveryStops.sequenceNumber)
        .then(rows => rows.map(row => ({
          ...row,
          contactName: null,
          contactPhone: null,
        })))
    }
  }

  const mapStops = stops.map(s => ({
    id: s.id,
    lat: parseFloat(s.lat ?? '0'),
    lng: parseFloat(s.lng ?? '0'),
    label: String(s.sequenceNumber),
    title: s.companyName ?? s.address,
    address: s.address,
    contactName: s.contactName,
    contactPhone: s.contactPhone,
    status: s.status,
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">My Route Map</h1>
      <Card>
        <CardContent className="p-0 h-[600px] rounded-xl overflow-hidden">
          <DeliveryMapWrapper
            stops={mapStops}
            origin={
              driver?.homeLat && driver?.homeLng
                ? {
                    lat: parseFloat(driver.homeLat),
                    lng: parseFloat(driver.homeLng),
                    title: 'Home Base',
                    address: [driver.homeAddress, driver.homeCity, driver.homeState, driver.homeZip].filter(Boolean).join(', '),
                  }
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
