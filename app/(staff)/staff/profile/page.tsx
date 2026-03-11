import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { SimpleProfileForm } from '@/components/profile/SimpleProfileForm'

export default async function StaffProfilePage() {
  const session = await requireAdminOrStaff()
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-muted-foreground mt-1">Update your name, email, and phone number</p>
      </div>
      <SimpleProfileForm user={{ id: user.id, name: user.name, email: user.email, phone: user.phone }} />
    </div>
  )
}
