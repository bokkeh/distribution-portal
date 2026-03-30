import Image from 'next/image'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Clock3, MapPin, Navigation, Phone } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts, deliveries, deliveryStops, deliveryTrackingEvents, drivers, users } from '@/db/schema'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import { Card, CardContent } from '@/components/ui/card'
import { TrackingAutoRefresh } from '@/components/deliveries/TrackingAutoRefresh'
import { isDeliveryTrackingRateLimited } from '@/lib/auth/rate-limit'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import { toDisplayAvatarUrl } from '@/lib/users/avatar'
import { formatDate } from '@/lib/utils'
import DriverMessageButton from '@/components/share/DriverMessageButton'

function maskDriverName(name: string | null) {
  if (!name) return 'Your driver'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? 'Your driver'
  return `${parts[0]} ${parts[1][0]}.`
}

function formatMiles(value: string | null) {
  if (!value) return 'Updating'
  const miles = Number(value)
  if (!Number.isFinite(miles)) return 'Updating'
  return `${miles.toFixed(1)} mi`
}

export default async function PublicDeliveryTrackingPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string }
}) {
  const { token } = await Promise.resolve(params)
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headerStore.get('x-real-ip')?.trim()
  const userAgent = headerStore.get('user-agent')?.trim() ?? 'unknown'
  const viewerKey = forwardedFor || realIp || userAgent

  if (await isDeliveryTrackingRateLimited(`${token}:${viewerKey}`)) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">
              Please wait a moment before refreshing this tracking page again.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const requestTime = new Date()

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

  const [latestView] = await db
    .select({
      createdAt: deliveryTrackingEvents.createdAt,
    })
    .from(deliveryTrackingEvents)
    .where(and(
      eq(deliveryTrackingEvents.stopId, stop.id),
      eq(deliveryTrackingEvents.eventType, 'tracking_page_viewed'),
    ))
    .orderBy(desc(deliveryTrackingEvents.createdAt))
    .limit(1)

  if (!latestView || requestTime.getTime() - new Date(latestView.createdAt).getTime() > 5 * 60 * 1000) {
    await db.insert(deliveryTrackingEvents).values({
      deliveryId: stop.deliveryId,
      stopId: stop.id,
      eventType: 'tracking_page_viewed',
      eventData: {
        viewerKey,
        userAgent,
      },
    })
  }

  const driverAvatar = toDisplayAvatarUrl(stop.driverAvatarUrl)
  const staleLocation = stop.lastLocationAt
    ? requestTime.getTime() - new Date(stop.lastLocationAt).getTime() > 5 * 60 * 1000
    : true
  const officePhone = process.env.ADMIN_NOTIFICATION_PHONE ?? process.env.TELNYX_FROM_NUMBER ?? null
  const origin = stop.lastKnownDriverLat && stop.lastKnownDriverLng
    ? {
        lat: Number(stop.lastKnownDriverLat),
        lng: Number(stop.lastKnownDriverLng),
        title: 'Driver location',
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
  const maskedDriverName = maskDriverName(stop.driverName ?? null)

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <TrackingAutoRefresh />
      <div className="mx-auto max-w-md bg-white shadow-sm sm:my-6 sm:overflow-hidden sm:rounded-[32px]">
        <section className="bg-[#22324a] px-6 pb-6 pt-8 text-white">
          <p className="text-[2rem] font-light leading-tight">{stop.companyName ?? 'Delivery Tracking'}</p>
          <div className="mt-8 flex items-end gap-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white/70 bg-white/15 shadow-lg">
              {driverAvatar ? (
                <Image src={driverAvatar} alt={maskedDriverName} fill className="object-cover" unoptimized />
              ) : null}
            </div>
            <div className="pb-2">
              <p className="text-2xl font-medium">{maskedDriverName}</p>
              <p className="mt-1 text-sm text-slate-200">On the way with your delivery</p>
            </div>
          </div>
        </section>

        <section className="bg-slate-100">
          <div className="h-[420px]">
            <DeliveryMapWrapper stops={stops} origin={origin} />
          </div>
        </section>

        <section className="space-y-6 px-6 py-6">
          <div className="space-y-4 text-slate-600">
            <div className="flex items-start gap-4">
              <MapPin className="mt-0.5 h-6 w-6 text-slate-500" />
              <div>
                <p className="text-2xl font-light leading-tight text-slate-700">{stop.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Navigation className="h-6 w-6 text-slate-500" />
              <p className="text-2xl font-light text-slate-700">Est distance: {formatMiles(stop.distanceMiles)}</p>
            </div>

            <div className="flex items-center gap-4">
              <Clock3 className="h-6 w-6 text-slate-500" />
              <div>
                <p className="text-2xl font-light text-slate-700">
                  Est arrival time: {stop.etaMinutes ? `${stop.etaMinutes} mins` : 'Updating'}
                </p>
                {staleLocation ? (
                  <p className="mt-1 text-xs font-medium text-amber-600">ETA is based on the most recent location update.</p>
                ) : null}
              </div>
            </div>

            {officePhone ? (
              <div className="flex items-center gap-4">
                <Phone className="h-6 w-6 text-slate-500" />
                <a href={`tel:${officePhone}`} className="text-2xl font-light text-sky-500 hover:text-sky-600">
                  Office phone: {officePhone}
                </a>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {stop.driverPhone ? <DriverMessageButton phone={stop.driverPhone} driverName={maskedDriverName} /> : null}
          </div>

          {stop.lastLocationAt ? (
            <p className="text-xs text-slate-400">Last updated {formatDate(stop.lastLocationAt)}</p>
          ) : null}
        </section>

        {stop.customerStatus === 'delivered' ? (
          <section className="border-t border-slate-100 px-6 py-6 text-sm text-slate-600">
            <p>Delivered {stop.deliveredAt ? formatDate(stop.deliveredAt) : 'recently'}.</p>
            {stop.recipientSignedName ? <p className="mt-2">Signed by {stop.recipientSignedName}.</p> : null}
            <div className="mt-3 flex flex-wrap gap-3">
              {stop.proofOfDeliveryUrl ? (
                <a href={signedPhotoUrl(stop.proofOfDeliveryUrl) ?? stop.proofOfDeliveryUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                  View proof photo
                </a>
              ) : null}
              {stop.recipientSignatureUrl ? (
                <a href={signedPhotoUrl(stop.recipientSignatureUrl) ?? stop.recipientSignatureUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                  View signature
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
