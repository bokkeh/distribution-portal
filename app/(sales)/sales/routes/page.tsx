import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, salesRoutes, salesRouteStops, customerAccounts } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Map, MapPin, AlertCircle } from 'lucide-react'
import Link from 'next/link'

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map(route => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{route.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {route.frequency && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {route.frequency}
                      </Badge>
                    )}
                    {route.region && (
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {route.region}
                      </Badge>
                    )}
                  </div>
                </div>
                {route.description && (
                  <p className="text-sm text-slate-500">{route.description}</p>
                )}
              </CardHeader>
              <CardContent>
                {route.originAddress && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {route.originAddress}
                  </div>
                )}
                <div className="mt-3">
                  <Link
                    href={`/admin/sales-routes/${route.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View stops & optimize →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
