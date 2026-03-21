import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, salesRoutes, salesRouteStops, customerAccounts } from '@/db/schema'
import { and, eq, asc, inArray } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Map, MapPin, Phone, AlertCircle, CheckCircle2 } from 'lucide-react'
import { RouteStopCheckIn } from './RouteStopCheckIn'

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
      </div>
    )
  }

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

  // Fetch stops for all routes
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Routes</h1>
        <p className="text-slate-500 mt-1">{routes.length} active route{routes.length !== 1 ? 's' : ''}</p>
      </div>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No routes assigned yet.</p>
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
                    <p className="text-sm text-slate-400 text-center py-4">No stops on this route yet.</p>
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
