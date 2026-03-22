import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, salesRoutes, salesRouteStops, customerAccounts, salesRegions } from '@/db/schema'
import { and, eq, asc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Map, MapPin, Phone, Plus, AlertCircle, CheckCircle2, Route } from 'lucide-react'
import { RouteStopCheckIn } from './RouteStopCheckIn'
import { createSalesRepRoute } from '@/actions/sales-routes'
import { getSalesRepRegionMapData } from '@/actions/sales-rep-map'
import { SalesRepRegionMap } from '@/components/sales/SalesRepRegionMap'

export default async function SalesRoutesPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  if (!member) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
        <p className="text-sm mt-1 text-slate-400">Ask an admin to set up your sales profile.</p>
      </div>
    )
  }

  // Rep's assigned region(s)
  const [repRegion] = await db
    .select({ id: salesRegions.id, name: salesRegions.name })
    .from(salesRegions)
    .where(eq(salesRegions.assignedManagerId, member.id))
    .limit(1)

  const mapData = await getSalesRepRegionMapData()

  const routes = await db
    .select()
    .from(salesRoutes)
    .where(
      and(
        eq(salesRoutes.assignedSalesMemberId, member.id),
        eq(salesRoutes.status, 'active'),
      )
    )
    .orderBy(asc(salesRoutes.name))

  const routeIds = routes.map(r => r.id)
  const allStops = routeIds.length
    ? await db
        .select({
          stop: salesRouteStops,
          account: {
            id: customerAccounts.id,
            companyName: customerAccounts.companyName,
            phone: customerAccounts.phone,
          },
        })
        .from(salesRouteStops)
        .leftJoin(customerAccounts, eq(salesRouteStops.customerId, customerAccounts.id))
        .where(inArray(salesRouteStops.routeId, routeIds))
        .orderBy(asc(salesRouteStops.sequenceNumber))
    : []

  const stopsByRoute = allStops.reduce<Record<string, typeof allStops>>((acc, s) => {
    if (!acc[s.stop.routeId]) acc[s.stop.routeId] = []
    acc[s.stop.routeId].push(s)
    return acc
  }, {})

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Routes</h1>
          <p className="text-slate-500 mt-1">
            {routes.length} active route{routes.length !== 1 ? 's' : ''}
            {repRegion && (
              <span className="ml-2 text-xs text-slate-400">· Region: {repRegion.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* Region map */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {mapData.regionName ? `${mapData.regionName} Region` : 'My Region'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mapData.accounts.length} account{mapData.accounts.length !== 1 ? 's' : ''} · markers coloured by visit health
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
            {[
              { color: '#22C55E', label: 'Healthy' },
              { color: '#F59E0B', label: 'Overdue' },
              { color: '#EF4444', label: 'Critical' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <SalesRepRegionMap data={mapData} />
      </div>

      {/* Create route form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New Route
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSalesRepRoute} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48 space-y-1.5">
              <label htmlFor="route-name" className="text-sm font-medium text-slate-900">
                Route Name <span className="text-red-500">*</span>
              </label>
              <input
                id="route-name"
                name="name"
                required
                placeholder={repRegion ? `e.g. ${repRegion.name} Monday Run` : 'e.g. Monday Morning Run'}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex-1 min-w-48 space-y-1.5">
              <label htmlFor="route-description" className="text-sm font-medium text-slate-900">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="route-description"
                name="description"
                placeholder="Optional notes about this route"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" className="shrink-0">
              <Route className="w-4 h-4 mr-2" />
              Create Route
            </Button>
          </form>
          {repRegion && (
            <p className="text-xs text-slate-400 mt-2">
              Route will be created for your region: <span className="font-medium text-slate-500">{repRegion.name}</span>.
              You can add stops from your region's accounts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Route list */}
      {routes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No routes yet. Create your first route above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {routes.map(route => {
            const stops = stopsByRoute[route.id] ?? []
            const visitedToday = stops.filter(s => s.stop.visitedAt && new Date(s.stop.visitedAt) >= today).length

            return (
              <Card key={route.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base">{route.name}</CardTitle>
                      {route.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{route.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {route.frequency && (
                        <Badge variant="outline" className="text-xs capitalize">{route.frequency}</Badge>
                      )}
                      {stops.length > 0 && (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                          {visitedToday}/{stops.length} visited today
                        </Badge>
                      )}
                      <Link href={`/sales/routes/${route.id}`}>
                        <Button variant="outline" size="sm">
                          <MapPin className="w-3.5 h-3.5 mr-1.5" />
                          Open Route
                        </Button>
                      </Link>
                    </div>
                  </div>
                  {route.originAddress && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Start: {route.originAddress}
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  {stops.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400">No stops yet.</p>
                      <Link href={`/sales/routes/${route.id}?addStop=1`} className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                        Add your first stop →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {stops.map(({ stop, account }) => {
                        const visitedToday = stop.visitedAt && new Date(stop.visitedAt) >= today

                        return (
                          <div
                            key={stop.id}
                            className={`flex items-center gap-3 py-3 border-b last:border-0 ${visitedToday ? 'opacity-60' : ''}`}
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {stop.sequenceNumber}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {account?.companyName ?? stop.address}
                              </p>
                              {account?.companyName && (
                                <p className="text-xs text-slate-400">{stop.address}</p>
                              )}
                              {stop.contactName && (
                                <p className="text-xs text-slate-500">{stop.contactName}</p>
                              )}
                              {(stop.contactPhone ?? account?.phone) && (
                                <a
                                  href={`tel:${stop.contactPhone ?? account?.phone}`}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                                >
                                  <Phone className="w-3 h-3" />
                                  {stop.contactPhone ?? account?.phone}
                                </a>
                              )}
                              {stop.notes && (
                                <p className="text-xs text-slate-400 italic mt-0.5">{stop.notes}</p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {visitedToday ? (
                                <div className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="hidden sm:inline">Visited</span>
                                </div>
                              ) : (
                                <RouteStopCheckIn stopId={stop.id} />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
