import { db } from '@/db'
import { salesRoutes, salesRouteStops } from '@/db/schema'
import { count, desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, MapPin, Plus, Route } from 'lucide-react'
import { createSalesRoute, deleteSalesRoute } from '@/actions/sales-routes'

export default async function SalesRoutesPage() {
  const routes = await db
    .select({
      id: salesRoutes.id,
      name: salesRoutes.name,
      description: salesRoutes.description,
      status: salesRoutes.status,
      createdAt: salesRoutes.createdAt,
      stopCount: count(salesRouteStops.id),
    })
    .from(salesRoutes)
    .leftJoin(salesRouteStops, eq(salesRouteStops.routeId, salesRoutes.id))
    .groupBy(salesRoutes.id)
    .orderBy(desc(salesRoutes.createdAt))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/crm">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Sales Routes</h1>
          <p className="text-muted-foreground mt-1">
            Build optimized routes for sales visits to customer accounts.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createSalesRoute} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-900">
                New Route Name
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="e.g. Monday NW Houston Run"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-slate-900">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="description"
                name="description"
                placeholder="Optional notes about this route"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />Create Route
            </Button>
          </form>
        </CardContent>
      </Card>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Route className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>No sales routes yet. Create your first route above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {routes.map((route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{route.name}</h3>
                      <Badge variant={route.status === 'active' ? 'success' : 'secondary'}>
                        {route.status}
                      </Badge>
                    </div>
                    {route.description && (
                      <p className="text-sm text-muted-foreground">{route.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{route.stopCount} {route.stopCount === 1 ? 'stop' : 'stops'}</span>
                      <span className="text-slate-300">·</span>
                      <span>Created {formatDate(route.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={deleteSalesRoute.bind(null, route.id)}>
                      <Button type="submit" variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:border-red-300">
                        Delete
                      </Button>
                    </form>
                    <Link href={`/admin/crm/sales-routes/${route.id}`}>
                      <Button variant="outline" size="sm">
                        <MapPin className="w-4 h-4 mr-2" />View Route
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
