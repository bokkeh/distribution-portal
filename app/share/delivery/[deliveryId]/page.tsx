import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { MapPin, Truck } from 'lucide-react'
import ShareRouteMap from '@/components/share/ShareRouteMap'

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
      .then((rows) => rows.map((r) => ({ ...r, contactName: null, contactPhone: null })))
  }

  const STATUS_COLORS: Record<string, string> = {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Delivery — {formatDate(delivery.weekStartDate)}</h1>
            <p className="text-sm text-slate-500">Driver: {delivery.driverName ?? 'Unassigned'}{delivery.driverPhone ? ` · ${delivery.driverPhone}` : ''}</p>
          </div>
          <div className="ml-auto text-xs text-slate-400 capitalize">
            {delivery.status.replace('_', ' ')} · {stops.length} stop{stops.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-[420px]">
            <ShareRouteMap stops={mapStops} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{stops.length} Stops</p>
          </div>
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
                    <p className="text-sm font-medium text-slate-900">{stop.companyName ?? '—'}</p>
                    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[stop.status] ?? 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-400 capitalize">{stop.status}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />{stop.address}
                  </p>
                  {stop.contactName && (
                    <p className="mt-0.5 text-xs text-slate-500">POC: {stop.contactName}{stop.contactPhone ? ` · ${stop.contactPhone}` : ''}</p>
                  )}
                  {stop.notes && (
                    <p className="mt-1 text-xs text-slate-400 italic">{stop.notes}</p>
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
