import { db } from '@/db'
import { salesRoutes, salesRouteStops, customerAccounts } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import SalesRouteMapAndList from '@/components/sales-routes/SalesRouteMapAndList'
import CopyShareLink from '@/components/share/CopyShareLink'
import RerunRouteButton from '@/components/sales-routes/RerunRouteButton'
import { deleteSalesRoute } from '@/actions/sales-routes'
import AddSalesRouteStopForm from '@/components/sales-routes/AddStopForm'

export default async function SalesRouteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ routeId: string }> | { routeId: string }
  searchParams?: Promise<{ addStop?: string; error?: string }> | { addStop?: string; error?: string }
}) {
  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {})
  const showAddStop = resolvedSearchParams.addStop === '1'
  const addStopError = resolvedSearchParams.error

  const [route] = await db
    .select()
    .from(salesRoutes)
    .where(eq(salesRoutes.id, resolvedParams.routeId))

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
    .where(eq(salesRouteStops.routeId, resolvedParams.routeId))
    .orderBy(asc(salesRouteStops.sequenceNumber))

  const accounts = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
    })
    .from(customerAccounts)
    .orderBy(asc(customerAccounts.companyName))

  const initialStops = stops.map((stop) => ({
    id: stop.id,
    sequenceNumber: stop.sequenceNumber,
    address: stop.address,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
    notes: stop.notes,
    companyName: stop.companyName,
    lat: stop.lat ? parseFloat(stop.lat) : null,
    lng: stop.lng ? parseFloat(stop.lng) : null,
  }))

  const origin =
    route.originAddress && route.originLat && route.originLng
      ? {
          address: route.originAddress,
          lat: parseFloat(route.originLat),
          lng: parseFloat(route.originLng),
        }
      : null

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/crm/sales-routes">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{route.name}</h1>
          {route.description && (
            <p className="text-muted-foreground mt-1">{route.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Created {formatDate(route.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <RerunRouteButton routeId={resolvedParams.routeId} defaultName={route.name} />
          <CopyShareLink path={`/share/sales-route/${resolvedParams.routeId}`} />
          <form action={deleteSalesRoute.bind(null, route.id)}>
            <Button type="submit" variant="outline" className="text-red-600 hover:text-red-700 hover:border-red-300">
              Delete Route
            </Button>
          </form>
          <Link
            href={
              showAddStop
                ? `/admin/crm/sales-routes/${resolvedParams.routeId}`
                : `/admin/crm/sales-routes/${resolvedParams.routeId}?addStop=1`
            }
          >
            <Button variant="outline">Add Stop</Button>
          </Link>
          <Badge variant={route.status === 'active' ? 'success' : 'secondary'}>{route.status}</Badge>
        </div>
      </div>

      {showAddStop && (
        <Card>
          <CardHeader><CardTitle>Add Stop</CardTitle></CardHeader>
          <CardContent>
            <AddSalesRouteStopForm
              routeId={resolvedParams.routeId}
              accounts={accounts}
              error={addStopError}
            />
          </CardContent>
        </Card>
      )}

      <SalesRouteMapAndList routeId={resolvedParams.routeId} initialStops={initialStops} origin={origin} />
    </div>
  )
}
