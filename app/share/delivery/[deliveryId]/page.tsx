import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { MapPin, Shield, Truck } from 'lucide-react'
import ShareRouteMap from '@/components/share/ShareRouteMap'
import GetDirectionsButton from '@/components/shared/GetDirectionsButton'
import CopyAddressButton from '@/components/share/CopyAddressButton'
import DriverMessageButton from '@/components/share/DriverMessageButton'

function maskDriverName(name: string | null) {
  if (!name) return 'Your driver'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? 'Your driver'
  return `${parts[0]} ${parts[1][0]}.`
}

export default async function ShareDeliveryPage({
  params,
}: {
  params: Promise<{ deliveryId: string }> | { deliveryId: string }
}) {
  const { deliveryId } = await Promise.resolve(params)

  const [delivery] = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      driverName: users.name,
      driverPhone: users.phone,
      originAddress: deliveries.originAddress,
      originLat: deliveries.originLat,
      originLng: deliveries.originLng,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(deliveries.id, deliveryId))

  if (!delivery) notFound()

  let stops: Array<{
    id: string
    sequenceNumber: number
    address: string
    contactName: string | null
    contactPhone: string | null
    lat: string | null
    lng: string | null
    status: 'pending' | 'delivered' | 'failed'
    notes: string | null
    companyName: string | null
  }> = []

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
        notes: deliveryStops.notes,
        companyName: customerAccounts.companyName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(eq(deliveryStops.deliveryId, deliveryId))
      .orderBy(asc(deliveryStops.sequenceNumber))
  } catch {
    stops = await db
      .select({
        id: deliveryStops.id,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        status: deliveryStops.status,
        notes: deliveryStops.notes,
        companyName: customerAccounts.companyName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(eq(deliveryStops.deliveryId, deliveryId))
      .orderBy(asc(deliveryStops.sequenceNumber))
      .then((rows) => rows.map((row) => ({ ...row, contactName: null, contactPhone: null })))
  }

  const originAddress = delivery.originAddress?.trim() || null
  const origin =
    originAddress && delivery.originLat && delivery.originLng
      ? { address: originAddress, lat: parseFloat(delivery.originLat), lng: parseFloat(delivery.originLng) }
      : null

  const statusColors: Record<string, string> = {
    pending: 'bg-blue-500',
    delivered: 'bg-green-500',
    failed: 'bg-red-500',
  }

  const mapStops = stops.map((stop) => ({
    id: stop.id,
    lat: stop.lat ? parseFloat(stop.lat) : 0,
    lng: stop.lng ? parseFloat(stop.lng) : 0,
    label: String(stop.sequenceNumber),
    title: stop.companyName ?? stop.address,
    address: stop.address,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
    status: stop.status,
  }))

  const maskedDriverName = maskDriverName(delivery.driverName ?? null)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Delivery - {formatDate(delivery.weekStartDate)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Driver: {maskedDriverName}</span>
              {delivery.driverPhone ? <DriverMessageButton phone={delivery.driverPhone} driverName={maskedDriverName} /> : null}
            </div>
          </div>
          <div className="ml-auto text-xs capitalize text-slate-400">
            {delivery.status.replace('_', ' ')} - {stops.length} stop{stops.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-[420px]">
            <ShareRouteMap stops={mapStops} origin={origin} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{stops.length} Stop{stops.length !== 1 ? 's' : ''}</p>
            {stops.length > 0 ? (
              <GetDirectionsButton
                stops={stops.map((stop) => ({ address: stop.address, lat: stop.lat ? parseFloat(stop.lat) : null, lng: stop.lng ? parseFloat(stop.lng) : null }))}
                originAddress={originAddress}
              />
            ) : null}
          </div>

          {originAddress ? (
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">H</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Starting Location</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-700">
                  <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                  {originAddress}
                </p>
              </div>
            </div>
          ) : null}

          <div className="divide-y divide-slate-100">
            {stops.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No stops on this delivery.</p>
            ) : stops.map((stop) => (
              <div key={stop.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                  {stop.sequenceNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{stop.companyName ?? 'Stop'}</p>
                    <span className={`inline-block h-2 w-2 rounded-full ${statusColors[stop.status] ?? 'bg-slate-400'}`} />
                    <span className="text-xs capitalize text-slate-400">{stop.status}</span>
                  </div>
                  <div className="mt-0.5 flex items-start gap-2 text-xs text-slate-500">
                    <p className="flex min-w-0 items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{stop.address}</span>
                    </p>
                    <CopyAddressButton address={stop.address} />
                  </div>
                  {stop.notes ? (
                    <p className="mt-2 text-xs italic text-slate-400">{stop.notes}</p>
                  ) : (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Shield className="h-3 w-3" />
                      Contact details and editing are hidden on shared links.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
