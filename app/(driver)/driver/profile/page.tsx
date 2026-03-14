import { db } from '@/db'
import { users, drivers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { DriverProfileForm } from '@/components/profile/DriverProfileForm'

export default async function DriverProfilePage() {
  const session = await requireRole('driver', 'admin')

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, session.user.id))
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.user.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-muted-foreground mt-1">Update your personal info and vehicle details</p>
      </div>
      <DriverProfileForm
        user={{ id: user.id, name: user.name, email: user.email, phone: user.phone }}
        driver={driver ? {
          id: driver.id,
          vehicleMake: driver.vehicleMake,
          vehicleModel: driver.vehicleModel,
          vehicleYear: driver.vehicleYear,
          vin: driver.vin,
          licensePlate: driver.licensePlate,
          vehicleImageUrl: driver.vehicleImageUrl,
          homeAddress: driver.homeAddress,
          homeCity: driver.homeCity,
          homeState: driver.homeState,
          homeZip: driver.homeZip,
        } : null}
      />
    </div>
  )
}
