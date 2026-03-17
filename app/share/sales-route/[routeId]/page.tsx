import { db } from '@/db'
import { salesRoutes, salesRouteStops, customerAccounts } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { MapPin, Route } from 'lucide-react'
import ShareRouteMap from '@/components/share/ShareRouteMap'
import GetDirectionsButton from '@/components/shared/GetDirectionsButton'
import EditableShareOrigin from '@/components/share/EditableShareOrigin'
import EditableShareStopNotes from '@/components/share/EditableShareStopNotes'
import CopyAddressButton from '@/components/share/CopyAddressButton'
import { updateSharedSalesRouteOrigin, updateSharedSalesRouteStopNotes } from '@/actions/share'

export default async function ShareSalesRoutePage({
  params,
}: {
  params: Promise<{ routeId: string }> | { routeId: string }
}) {
  const { routeId } = await Promise.resolve(params)

  const [route] = await db
    .select()
    .from(salesRoutes)
    .where(eq(salesRoutes.id, routeId))

  if (!route) notFound()

  const stops = await db
    .select({
      id: salesRouteStops.id,
      sequenceNumber: salesRouteStops.sequenceNumber,
      address: salesRouteStops.address,
      contactName: salesRouteStops.contactName,
      contactPhone: salesRouteStops.contactPhone,
      lat: salesRouteStops.lat,
      lng: salesRouteStops.lng,
      notes: salesRouteStops.notes,
      companyName: customerAccounts.companyName,
    })
    .from(salesRouteStops)
    .leftJoin(customerAccounts, eq(salesRouteStops.customerId, customerAccounts.id))
    .where(eq(salesRouteStops.routeId, routeId))
    .orderBy(asc(salesRouteStops.sequenceNumber))

  const mapStops = stops.map((stop, index) => ({
    id: stop.id,
    lat: stop.lat ? parseFloat(stop.lat) : 0,
    lng: stop.lng ? parseFloat(stop.lng) : 0,
    label: String(index + 1),
    title: stop.companyName ?? stop.address,
    address: stop.address,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
    status: 'pending' as const,
  }))

  const originAddress = route.originAddress?.trim() || null
  const origin =
    originAddress && route.originLat && route.originLng
      ? { address: originAddress, lat: parseFloat(route.originLat), lng: parseFloat(route.originLng) }
      : null

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600">
            <Route className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{route.name}</h1>
            {route.description && (
              <p className="text-sm text-slate-500">{route.description}</p>
            )}
          </div>
          <div className="ml-auto text-xs text-slate-400">
            {stops.length} stop{stops.length !== 1 ? 's' : ''} · Created {formatDate(route.createdAt)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-[420px]">
            <ShareRouteMap stops={mapStops} origin={origin} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{stops.length} Stop{stops.length !== 1 ? 's' : ''}</p>
            {stops.length > 0 && (
              <GetDirectionsButton
                stops={stops.map(s => ({ address: s.address, lat: s.lat ? parseFloat(s.lat) : null, lng: s.lng ? parseFloat(s.lng) : null }))}
                originAddress={originAddress}
              />
            )}
          </div>
          <EditableShareOrigin
            address={originAddress}
            onSave={updateSharedSalesRouteOrigin.bind(null, routeId)}
          />
          <div className="divide-y divide-slate-100">
            {stops.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No stops on this route.</p>
            ) : stops.map((stop, index) => (
              <div key={stop.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{stop.companyName ?? '—'}</p>
                  <div className="mt-0.5 flex items-start gap-2 text-xs text-slate-500">
                    <p className="flex min-w-0 items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{stop.address}</span>
                    </p>
                    <CopyAddressButton address={stop.address} />
                  </div>
                  {stop.contactName && (
                    <p className="mt-0.5 text-xs text-slate-500">POC: {stop.contactName}{stop.contactPhone ? ` · ${stop.contactPhone}` : ''}</p>
                  )}
                  <EditableShareStopNotes
                    notes={stop.notes}
                    onSave={updateSharedSalesRouteStopNotes.bind(null, routeId, stop.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
