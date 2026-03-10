import { db } from '@/db'
import { drivers, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'

export default async function DriversPage() {
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Drivers</h1>
          <p className="text-muted-foreground mt-1">{allDrivers.length} registered drivers</p>
        </div>
        <Link href="/admin/users/new">
          <Button><Plus className="w-4 h-4 mr-2" />Add Driver</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allDrivers.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>No drivers added yet.</p>
          </div>
        ) : allDrivers.map(driver => (
          <Card key={driver.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">{driver.email}</p>
                  </div>
                </div>
                <Badge variant={driver.active ? 'success' : 'secondary'}>{driver.active ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>📞 {driver.phone ?? 'No phone'}</p>
                {driver.vehicleMake && <p>🚗 {driver.vehicleMake} {driver.vehicleModel}</p>}
                {driver.licensePlate && <p>🪪 {driver.licensePlate}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
