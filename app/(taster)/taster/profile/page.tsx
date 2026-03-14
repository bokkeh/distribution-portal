import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { SimpleProfileForm } from '@/components/profile/SimpleProfileForm'
import { requireFeature } from '@/lib/auth/session'

export default async function TasterProfilePage() {
  const session = await requireFeature('profile', 'taster', 'admin')
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      address: users.address,
      city: users.city,
      state: users.state,
      zip: users.zip,
    })
    .from(users)
    .where(eq(users.id, session.user.id))

  if (!user) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-muted-foreground mt-1">Keep your phone number current so tasting assignments reach you by text.</p>
      </div>
      <SimpleProfileForm user={user} />
    </div>
  )
}
