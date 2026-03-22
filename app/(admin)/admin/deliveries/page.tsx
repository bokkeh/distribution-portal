import { db } from '@/db'
import { deliveries, drivers, users, deliveryStops, customerAccounts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Truck, MapPin } from 'lucide-react'
import { deleteDelivery } from '@/actions/deliveries'
import { PhoneActions } from '@/components/shared/PhoneActions'

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
}

export default async function DeliveriesPage() {
  const allDrivers = await db
    .select({
      id: drivers.id,
      vehicleMake: drivers.vehicleMake,
      vehicleModel: drivers.vehicleModel,
      licensePlate: drivers.licensePlate,
      active: drivers.active,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .orderBy(users.name)

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
          <h1 className="text-2xl font-bold text-slate-900">Drivers & Deliveries</h1>
          <p className="text-muted-foreground mt-1">Manage drivers, assigned delivery dates, and active routes from one page.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/users/new">
            <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Add Driver</Button>
          </Link>
          <Link href="/admin/deliveries/new">
            <Button><Plus className="w-4 h-4 mr-2" />Schedule Delivery</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver Roster</CardTitle>
          <p className="text-sm text-muted-foreground">
            View active drivers, contact details, and assigned vehicle information.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {allDrivers.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No drivers added yet.
              </div>
            ) : allDrivers.map((driver) => (
              <div key={driver.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{driver.name}</p>
                    <p className="text-xs text-slate-500">{driver.email}</p>
                  </div>
                  <Badge variant={driver.active ? 'success' : 'secondary'}>{driver.active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  {driver.phone
                    ? <PhoneActions phone={driver.phone} name={driver.name ?? 'Driver'} />
                    : <p>No phone on file</p>
                  }
                  {driver.vehicleMake ? <p>{driver.vehicleMake} {driver.vehicleModel}</p> : null}
                  {driver.licensePlate ? <p>{driver.licensePlate}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Deliveries</h2>
          <p className="text-sm text-muted-foreground">Review scheduled delivery dates, assigned drivers, and route status.</p>
        </div>
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
                    <h3 className="font-semibold">Delivery Date {formatDate(delivery.weekStartDate)}</h3>
                    <Badge variant={statusVariant[delivery.status]}>{delivery.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="w-4 h-4" />
                    <span>Driver: {delivery.driverName ?? 'Unassigned'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={deleteDelivery.bind(null, delivery.id)}>
                    <Button type="submit" variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:border-red-300">
                      Delete
                    </Button>
                  </form>
                  <Link href={`/admin/deliveries/${delivery.id}`}>
                    <Button variant="outline">
                      <MapPin className="w-4 h-4 mr-2" />View Route
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
