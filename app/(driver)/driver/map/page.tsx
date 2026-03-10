import { db } from '@/db'
import { deliveries, deliveryStops, drivers, customerAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DriverMapPage() {
  const session = await requireRole('driver', 'admin')

  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.user.id))

  const stops = driver ? await db
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
    .orderBy(deliveryStops.sequenceNumber) : []

  const mapStops = stops.map(s => ({
    id: s.id,
    lat: parseFloat(s.lat ?? '0'),
    lng: parseFloat(s.lng ?? '0'),
    label: String(s.sequenceNumber),
    title: s.companyName ?? s.address,
    address: s.address,
    status: s.status,
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">My Route Map</h1>
      <Card>
        <CardContent className="p-0 h-[600px] rounded-xl overflow-hidden">
          <DeliveryMapWrapper stops={mapStops} />
        </CardContent>
      </Card>
    </div>
  )
}
