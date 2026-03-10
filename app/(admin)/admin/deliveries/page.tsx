import { db } from '@/db'
import { deliveries, drivers, users, deliveryStops, customerAccounts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Truck, MapPin } from 'lucide-react'

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
}

export default async function DeliveriesPage() {
  const allDeliveries = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      createdAt: deliveries.createdAt,
      driverName: users.name,
      driverPhone: users.phone,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .orderBy(desc(deliveries.weekStartDate))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Scheduling</h1>
          <p className="text-muted-foreground mt-1">Manage weekly delivery routes</p>
        </div>
        <Link href="/admin/deliveries/new">
          <Button><Plus className="w-4 h-4 mr-2" />Schedule Delivery</Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {allDeliveries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>No deliveries scheduled yet.</p>
            </CardContent>
          </Card>
        ) : allDeliveries.map(delivery => (
          <Card key={delivery.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">Week of {formatDate(delivery.weekStartDate)}</h3>
                    <Badge variant={statusVariant[delivery.status]}>{delivery.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="w-4 h-4" />
                    <span>Driver: {delivery.driverName ?? 'Unassigned'}</span>
                  </div>
                </div>
                <Link href={`/admin/deliveries/${delivery.id}`}>
                  <Button variant="outline">
                    <MapPin className="w-4 h-4 mr-2" />View Route
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
