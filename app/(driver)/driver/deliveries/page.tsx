import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { updateStopStatus } from '@/actions/deliveries'
import { MapPin, CheckCircle, XCircle, Clock, Truck } from 'lucide-react'

export default async function DriverDeliveriesPage() {
  const session = await requireRole('driver', 'admin')

  // Find driver record for current user
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
    <div className="space-y-6">
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
      ) : myDeliveries.map(async (delivery) => {
        const stops = await db
          .select({
            id: deliveryStops.id, sequenceNumber: deliveryStops.sequenceNumber,
            address: deliveryStops.address, status: deliveryStops.status,
            companyName: customerAccounts.companyName,
          })
          .from(deliveryStops)
          .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
          .where(eq(deliveryStops.deliveryId, delivery.id))
          .orderBy(deliveryStops.sequenceNumber)

        return (
          <Card key={delivery.id}>
            <CardHeader>
              <CardTitle className="text-base">Week of {formatDate(delivery.weekStartDate)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stops.map(stop => (
                <div key={stop.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {stop.sequenceNumber}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{stop.companyName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{stop.address}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {stop.status === 'pending' ? (
                      <>
                        <form action={updateStopStatus.bind(null, stop.id, 'delivered')}>
                          <button className="p-1 text-green-600 hover:bg-green-50 rounded" type="submit" title="Mark Delivered">
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        </form>
                        <form action={updateStopStatus.bind(null, stop.id, 'failed')}>
                          <button className="p-1 text-red-600 hover:bg-red-50 rounded" type="submit" title="Mark Failed">
                            <XCircle className="w-5 h-5" />
                          </button>
                        </form>
                      </>
                    ) : (
                      <Badge variant={stop.status === 'delivered' ? 'success' : 'destructive'}>{stop.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
