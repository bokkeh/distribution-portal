import { db } from '@/db'
import { deliveries, deliveryStops, drivers, customerAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { updateStopNotes, updateStopStatus } from '@/actions/deliveries'
import { MapPin, CheckCircle, XCircle, Clock, Truck } from 'lucide-react'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'

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
            <CardContent className="space-y-4">
              <div className="h-[420px] overflow-hidden rounded-xl border">
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

              <div className="space-y-3">
                {stops.map(stop => (
                  <div key={stop.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {stop.sequenceNumber}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{stop.companyName}</p>
                          {stop.status === 'pending' ? (
                            <div className="flex gap-2">
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
                            </div>
                          ) : (
                            <Badge variant={stop.status === 'delivered' ? 'success' : 'destructive'}>{stop.status}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />{stop.address}
                        </p>
                        {(stop.contactName || stop.contactPhone || stop.contactEmail) && (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {stop.contactName && <p>POC: {stop.contactName}</p>}
                            {stop.contactPhone && <p>Phone: {stop.contactPhone}</p>}
                            {stop.contactEmail && <p>Email: {stop.contactEmail}</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    <form action={updateStopNotes.bind(null, stop.id)} className="mt-3 space-y-2">
                      <label htmlFor={`notes-${stop.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Driver Notes
                      </label>
                      <textarea
                        id={`notes-${stop.id}`}
                        name="notes"
                        defaultValue={stop.notes ?? ''}
                        placeholder="Add delivery updates, gate codes, owner requests, or other notes."
                        className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <div className="flex justify-end">
                        <Button type="submit" variant="outline" size="sm">Save Notes</Button>
                      </div>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
