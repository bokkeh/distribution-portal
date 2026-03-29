import Image from 'next/image'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, deliveries, deliveryStops, drivers, users } from '@/db/schema'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrackingAutoRefresh } from '@/components/deliveries/TrackingAutoRefresh'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import { toDisplayAvatarUrl } from '@/lib/users/avatar'
import { formatDate } from '@/lib/utils'

export default async function PublicDeliveryTrackingPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string }
}) {
  const { token } = await Promise.resolve(params)

  const [stop] = await db
    .select({
      id: deliveryStops.id,
      deliveryId: deliveryStops.deliveryId,
      address: deliveryStops.address,
      status: deliveryStops.status,
      customerStatus: deliveryStops.customerStatus,
      etaMinutes: deliveryStops.etaMinutes,
      distanceMiles: deliveryStops.distanceMiles,
      trackingExpiresAt: deliveryStops.trackingExpiresAt,
      lastKnownDriverLat: deliveryStops.lastKnownDriverLat,
      lastKnownDriverLng: deliveryStops.lastKnownDriverLng,
      lastLocationAt: deliveryStops.lastLocationAt,
      proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
      recipientSignatureUrl: deliveryStops.recipientSignatureUrl,
      recipientSignedName: deliveryStops.recipientSignedName,
      deliveredAt: deliveryStops.deliveredAt,
      companyName: customerAccounts.companyName,
      deliveryStatus: deliveries.status,
      driverName: users.name,
      driverPhone: users.phone,
      driverAvatarUrl: users.avatarUrl,
      destinationLat: deliveryStops.lat,
      destinationLng: deliveryStops.lng,
    })
    .from(deliveryStops)
    .innerJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id))
    .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(deliveryStops.trackingToken, token))
    .limit(1)

  if (!stop) notFound()
  if (stop.trackingExpiresAt && new Date(stop.trackingExpiresAt) < new Date()) notFound()

  const driverAvatar = toDisplayAvatarUrl(stop.driverAvatarUrl)
  const origin = stop.lastKnownDriverLat && stop.lastKnownDriverLng
    ? {
        lat: Number(stop.lastKnownDriverLat),
        lng: Number(stop.lastKnownDriverLng),
        title: stop.driverName ?? 'Driver',
        address: 'Current driver location',
      }
    : null
  const stops = stop.destinationLat && stop.destinationLng ? [{
    id: stop.id,
    lat: Number(stop.destinationLat),
    lng: Number(stop.destinationLng),
    label: '1',
    title: stop.companyName ?? stop.address,
    address: stop.address,
    status: stop.customerStatus,
  }] : []

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <TrackingAutoRefresh />
      <div className="mx-auto max-w-4xl space-y-4">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[160px_1fr]">
            <div className="flex items-center justify-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-3xl bg-slate-200">
                {driverAvatar ? (
                  <Image src={driverAvatar} alt={stop.driverName ?? 'Driver'} fill className="object-cover" unoptimized />
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">AHAWC Delivery Tracking</Badge>
                <Badge variant={stop.customerStatus === 'delivered' ? 'success' : stop.customerStatus === 'arrived' ? 'warning' : 'secondary'}>
                  {stop.customerStatus.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{stop.driverName ?? 'Your driver'}</h1>
                <p className="text-sm text-slate-500">Delivery Driver</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">ETA</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{stop.etaMinutes ? `${stop.etaMinutes} min` : 'Updating'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Distance</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{stop.distanceMiles ? `${stop.distanceMiles} mi` : 'Updating'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Support</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{stop.driverPhone ?? 'AHAWC office'}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-900">{stop.companyName ?? 'Delivery destination'}</p>
                <p className="mt-1">{stop.address}</p>
                {stop.lastLocationAt ? <p className="mt-2 text-xs text-slate-500">Last updated {formatDate(stop.lastLocationAt)}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Live Delivery Map</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px] p-0">
            <DeliveryMapWrapper stops={stops} origin={origin} />
          </CardContent>
        </Card>

        {stop.customerStatus === 'delivered' ? (
          <Card>
            <CardHeader>
              <CardTitle>Delivered</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Delivered {stop.deliveredAt ? formatDate(stop.deliveredAt) : 'recently'}.</p>
              {stop.recipientSignedName ? <p>Signed by {stop.recipientSignedName}.</p> : null}
              <div className="flex flex-wrap gap-3">
                {stop.proofOfDeliveryUrl ? <a href={signedPhotoUrl(stop.proofOfDeliveryUrl) ?? stop.proofOfDeliveryUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">View proof photo</a> : null}
                {stop.recipientSignatureUrl ? <a href={signedPhotoUrl(stop.recipientSignatureUrl) ?? stop.recipientSignatureUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">View signature</a> : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
