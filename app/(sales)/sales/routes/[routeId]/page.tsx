import { db } from '@/db'
import { salesRoutes, salesRouteStops, salesMembers, salesRegions, customerAccounts } from '@/db/schema'
import { and, asc, eq, or } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth/session'
import SalesRouteMapAndList from '@/components/sales-routes/SalesRouteMapAndList'
import RepAddStopForm from './RepAddStopForm'

export default async function RepRouteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ routeId: string }>
  searchParams?: Promise<{ error?: string; addStop?: string }>
}) {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const { routeId } = await params
  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | undefined>
  const showAddStop = sp.addStop === '1'
  const addStopError = sp.error

  // Find the calling user's sales member record
  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  const [route] = await db
    .select()
    .from(salesRoutes)
    .where(
      and(
        eq(salesRoutes.id, routeId),
        // ensure it belongs to this rep (or allow admin to view any)
        session.user.role === 'admin'
          ? undefined
          : member
            ? eq(salesRoutes.assignedSalesMemberId, member.id)
            : eq(salesRoutes.id, routeId), // no-op fallback — will 404 below
      ),
    )

  if (!route) notFound()

  // Stops
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
      visitPhotoUrl: salesRouteStops.visitPhotoUrl,
      visitedAt: salesRouteStops.visitedAt,
      companyName: customerAccounts.companyName,
    })
    .from(salesRouteStops)
    .leftJoin(customerAccounts, eq(salesRouteStops.customerId, customerAccounts.id))
    .where(eq(salesRouteStops.routeId, routeId))
    .orderBy(asc(salesRouteStops.sequenceNumber))

  // Region accounts — only show accounts assigned to this rep's region (or rep directly)
  const regionAccounts = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
    })
    .from(customerAccounts)
    .where(
      member
        ? or(
            eq(customerAccounts.assignedSalesRepId, member.id),
            route.regionId
              ? eq(customerAccounts.assignedRegionId, route.regionId)
              : undefined,
          )
        : undefined,
    )
    .orderBy(asc(customerAccounts.companyName))

  const initialStops = stops.map(stop => ({
    id: stop.id,
    sequenceNumber: stop.sequenceNumber,
    address: stop.address,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
    notes: stop.notes,
    visitPhotoUrl: stop.visitPhotoUrl,
    visitedAt: stop.visitedAt,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/sales/routes">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{route.name}</h1>
          {route.description && (
            <p className="text-muted-foreground mt-0.5">{route.description}</p>
          )}
          {route.region && (
            <p className="text-xs text-slate-400 mt-0.5">Region: {route.region}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={showAddStop ? `/sales/routes/${routeId}` : `/sales/routes/${routeId}?addStop=1`}
          >
            <Button variant="outline" size="sm">
              {showAddStop ? 'Cancel' : 'Add Stop'}
            </Button>
          </Link>
          <Badge variant={route.status === 'active' ? 'success' : 'secondary'}>
            {route.status}
          </Badge>
        </div>
      </div>

      {/* Add stop panel */}
      {showAddStop && (
        <Card>
          <CardHeader><CardTitle>Add Stop</CardTitle></CardHeader>
          <CardContent>
            <RepAddStopForm
              routeId={routeId}
              accounts={regionAccounts}
              error={addStopError}
            />
          </CardContent>
        </Card>
      )}

      {/* Map + stop list — full route builder experience */}
      <SalesRouteMapAndList
        routeId={routeId}
        initialStops={initialStops}
        origin={origin}
      />
    </div>
  )
}
