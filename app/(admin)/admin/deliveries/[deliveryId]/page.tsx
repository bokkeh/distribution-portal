import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import Link from 'next/link'
import { ArrowLeft, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react'

export default async function DeliveryDetailPage({ params }: { params: { deliveryId: string } }) {
  const [delivery] = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      driverName: users.name,
      driverPhone: users.phone,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(deliveries.id, params.deliveryId))

  if (!delivery) notFound()

  const stops = await db
    .select({
      id: deliveryStops.id,
      sequenceNumber: deliveryStops.sequenceNumber,
      address: deliveryStops.address,
      lat: deliveryStops.lat,
      lng: deliveryStops.lng,
      status: deliveryStops.status,
      notes: deliveryStops.notes,
      completedAt: deliveryStops.completedAt,
      companyName: customerAccounts.companyName,
    })
    .from(deliveryStops)
    .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
    .where(eq(deliveryStops.deliveryId, params.deliveryId))
    .orderBy(deliveryStops.sequenceNumber)

  const stopIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-yellow-500" />,
    delivered: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  }

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
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Week of {formatDate(delivery.weekStartDate)}</h1>
          <p className="text-muted-foreground mt-1">Driver: {delivery.driverName} · {delivery.driverPhone}</p>
        </div>
        <Badge variant={delivery.status === 'completed' ? 'success' : delivery.status === 'in_progress' ? 'warning' : 'info'}>
          {delivery.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Map */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Route Map</CardTitle></CardHeader>
          <CardContent className="p-0 h-96 rounded-b-xl overflow-hidden">
            <DeliveryMapWrapper stops={mapStops} />
          </CardContent>
        </Card>

        {/* Stop List */}
        <Card>
          <CardHeader><CardTitle>{stops.length} Stops</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stops.map(stop => (
              <div key={stop.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {stop.sequenceNumber}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{stop.companyName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{stop.address}
                  </p>
                  {stop.completedAt && (
                    <p className="text-xs text-muted-foreground mt-1">Completed {formatDate(stop.completedAt)}</p>
                  )}
                </div>
                {stopIcon[stop.status]}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
