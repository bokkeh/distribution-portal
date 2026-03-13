import { db } from '@/db'
import { deliveries, deliveryStops, drivers, customerAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { Truck } from 'lucide-react'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import SortableStopList from '@/components/deliveries/SortableStopList'

export default async function DriverDeliveriesPage() {
  const session = await requireRole('driver', 'admin')

  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.user.id))

  if (!driver) {
    return (
      <div className="text-center py-12">
        <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-muted-foreground">No driver profile found. Contact your administrator.</p>
      </div>
    )
  }

  const myDeliveries = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
    })
    .from(deliveries)
    .where(and(eq(deliveries.driverId, driver.id), eq(deliveries.status, 'scheduled')))
    .limit(5)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Deliveries</h1>
        <p className="text-muted-foreground mt-1">Your assigned delivery runs</p>
      </div>

      {myDeliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>No deliveries assigned. Check back soon.</p>
          </CardContent>
        </Card>
      ) : myDeliveries.map(async delivery => {
        let stops: Array<{
          id: string
          sequenceNumber: number
          address: string
          status: 'pending' | 'delivered' | 'failed'
          contactName: string | null
          contactPhone: string | null
          contactEmail: string | null
          notes: string | null
          proofOfDeliveryUrl: string | null
          shelfPhotoUrl: string | null
          lat: string | null
          lng: string | null
          companyName: string | null
        }> = []

        try {
          stops = await db
            .select({
              id: deliveryStops.id,
              sequenceNumber: deliveryStops.sequenceNumber,
              address: deliveryStops.address,
              status: deliveryStops.status,
              contactName: deliveryStops.contactName,
              contactPhone: deliveryStops.contactPhone,
              contactEmail: deliveryStops.contactEmail,
              notes: deliveryStops.notes,
              proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
              shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
              lat: deliveryStops.lat,
              lng: deliveryStops.lng,
              companyName: customerAccounts.companyName,
            })
            .from(deliveryStops)
            .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
            .where(eq(deliveryStops.deliveryId, delivery.id))
            .orderBy(deliveryStops.sequenceNumber)
        } catch (error) {
          const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
            ?? (error as { cause?: { code?: string } } | null)?.cause?.code
          const message = error instanceof Error ? error.message.toLowerCase() : ''

          if (code !== '42703' && !message.includes('contact_name') && !message.includes('contact_phone') && !message.includes('contact_email')) {
            throw error
          }

          stops = await db
            .select({
              id: deliveryStops.id,
              sequenceNumber: deliveryStops.sequenceNumber,
              address: deliveryStops.address,
              status: deliveryStops.status,
              notes: deliveryStops.notes,
              lat: deliveryStops.lat,
              lng: deliveryStops.lng,
              companyName: customerAccounts.companyName,
            })
            .from(deliveryStops)
            .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
            .where(eq(deliveryStops.deliveryId, delivery.id))
            .orderBy(deliveryStops.sequenceNumber)
            .then(rows => rows.map(row => ({
              ...row,
              contactName: null,
              contactPhone: null,
              contactEmail: null,
              proofOfDeliveryUrl: null,
              shelfPhotoUrl: null,
            })))
        }

        const mapStops = stops.map(stop => ({
          id: stop.id,
          lat: parseFloat(stop.lat ?? '0'),
          lng: parseFloat(stop.lng ?? '0'),
          label: String(stop.sequenceNumber),
          title: stop.companyName ?? stop.address,
          address: stop.address,
          contactName: stop.contactName,
          contactPhone: stop.contactPhone,
          status: stop.status,
        }))

        return (
          <Card key={delivery.id}>
            <CardHeader>
              <CardTitle className="text-base">Delivery Date {formatDate(delivery.weekStartDate)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="h-[320px] sm:h-[420px] overflow-hidden rounded-xl border">
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
              </div>

              <SortableStopList deliveryId={delivery.id} stops={stops} mode="driver" />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
