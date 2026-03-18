import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts } from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { requireAdmin } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Clock, MapPin, Camera, User, Truck } from 'lucide-react'

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(ms: number): string {
  const totalMins = Math.round(ms / 60000)
  if (totalMins < 60) return `${totalMins}m`
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default async function DeliveryReportsPage() {
  await requireAdmin()

  const completedDeliveries = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      createdAt: deliveries.createdAt,
      driverName: users.name,
      driverAvatarUrl: users.avatarUrl,
      vehicleMake: drivers.vehicleMake,
      vehicleModel: drivers.vehicleModel,
      licensePlate: drivers.licensePlate,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(deliveries.status, 'completed'))
    .orderBy(desc(deliveries.createdAt))
    .limit(30)

  if (completedDeliveries.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Reports</h1>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>No completed deliveries yet.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const deliveryIds = completedDeliveries.map(d => d.id)

  const allStops = await db
    .select({
      id: deliveryStops.id,
      deliveryId: deliveryStops.deliveryId,
      sequenceNumber: deliveryStops.sequenceNumber,
      address: deliveryStops.address,
      companyName: customerAccounts.companyName,
      lat: deliveryStops.lat,
      lng: deliveryStops.lng,
      status: deliveryStops.status,
      completedAt: deliveryStops.completedAt,
      proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
      shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
      additionalPhotoUrl: deliveryStops.additionalPhotoUrl,
    })
    .from(deliveryStops)
    .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
    .where(inArray(deliveryStops.deliveryId, deliveryIds))
    .orderBy(deliveryStops.deliveryId, deliveryStops.sequenceNumber)

  const stopsByDelivery = new Map<string, typeof allStops>()
  for (const stop of allStops) {
    const list = stopsByDelivery.get(stop.deliveryId) ?? []
    list.push(stop)
    stopsByDelivery.set(stop.deliveryId, list)
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{completedDeliveries.length} completed run{completedDeliveries.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-6">
        {completedDeliveries.map(delivery => {
          const stops = stopsByDelivery.get(delivery.id) ?? []
          const completedStops = stops.filter(s => s.completedAt)

          // Duration: earliest → latest completedAt
          const timestamps = completedStops.map(s => s.completedAt!.getTime()).sort((a, b) => a - b)
          const durationMs = timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : null

          // Mileage: sum haversine between consecutive stops that have coords
          let totalMiles = 0
          const coordStops = stops.filter(s => s.lat && s.lng)
          for (let i = 1; i < coordStops.length; i++) {
            totalMiles += haversineMiles(
              parseFloat(coordStops[i - 1].lat!),
              parseFloat(coordStops[i - 1].lng!),
              parseFloat(coordStops[i].lat!),
              parseFloat(coordStops[i].lng!),
            )
          }

          // All photos across all stops
          const photos: { url: string; label: string; stopLabel: string }[] = []
          for (const stop of stops) {
            const name = stop.companyName ?? stop.address
            if (stop.proofOfDeliveryUrl) photos.push({ url: stop.proofOfDeliveryUrl, label: 'Proof', stopLabel: name })
            if (stop.shelfPhotoUrl) photos.push({ url: stop.shelfPhotoUrl, label: 'Shelf', stopLabel: name })
            if (stop.additionalPhotoUrl) photos.push({ url: stop.additionalPhotoUrl, label: 'Extra', stopLabel: name })
          }

          const deliveredCount = stops.filter(s => s.status === 'delivered').length
          const failedCount = stops.filter(s => s.status === 'failed').length

          return (
            <Card key={delivery.id} className="overflow-hidden">
              <CardHeader className="pb-4 border-b bg-slate-50/60">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Driver */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                      {delivery.driverAvatarUrl ? (
                        <Image
                          src={delivery.driverAvatarUrl}
                          alt={delivery.driverName ?? 'Driver'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{delivery.driverName ?? 'Unknown Driver'}</p>
                      {(delivery.vehicleMake || delivery.licensePlate) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[delivery.vehicleMake, delivery.vehicleModel, delivery.licensePlate && `· ${delivery.licensePlate}`].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Title + link */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <CardTitle className="text-base">Delivery {formatDate(delivery.weekStartDate)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{stops.length} stop{stops.length !== 1 ? 's' : ''}</p>
                    </div>
                    <Badge variant="success">Completed</Badge>
                    <Link href={`/admin/deliveries/${delivery.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stops</p>
                    <p className="text-xl font-bold mt-1 text-slate-900">{stops.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {deliveredCount} delivered{failedCount > 0 ? `, ${failedCount} failed` : ''}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Duration</p>
                    <p className="text-xl font-bold mt-1 text-slate-900">
                      {durationMs !== null ? formatDuration(durationMs) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">first to last stop</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Mileage</p>
                    <p className="text-xl font-bold mt-1 text-slate-900">
                      {coordStops.length >= 2 ? `${totalMiles.toFixed(1)} mi` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">estimated route distance</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Camera className="w-3 h-3" />Photos</p>
                    <p className="text-xl font-bold mt-1 text-slate-900">{photos.length}</p>
                    <p className="text-xs text-muted-foreground">captured on route</p>
                  </div>
                </div>

                {/* Photos */}
                {photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Captured Photos</p>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((photo, i) => (
                        <a key={i} href={photo.url} target="_blank" rel="noreferrer" className="group relative">
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <Image
                              src={photo.url}
                              alt={`${photo.label} – ${photo.stopLabel}`}
                              fill
                              className="object-cover transition-opacity group-hover:opacity-80"
                              unoptimized
                            />
                          </div>
                          <div className="mt-1 text-center">
                            <p className="text-[10px] font-medium text-slate-700 leading-tight">{photo.label}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight max-w-[5rem] truncate">{photo.stopLabel}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stop list */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Stop Summary</p>
                  <div className="space-y-1.5">
                    {stops.map(stop => (
                      <div key={stop.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {stop.sequenceNumber}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-slate-800">{stop.companyName ?? stop.address}</span>
                        {stop.completedAt && (
                          <span className="text-xs text-muted-foreground shrink-0" suppressHydrationWarning>
                            {stop.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <Badge
                          variant={stop.status === 'delivered' ? 'success' : stop.status === 'failed' ? 'destructive' : 'secondary'}
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {stop.status}
                        </Badge>
                        {(stop.proofOfDeliveryUrl || stop.shelfPhotoUrl || stop.additionalPhotoUrl) && (
                          <Camera className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
