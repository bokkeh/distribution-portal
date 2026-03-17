import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { SimpleProfileForm } from '@/components/profile/SimpleProfileForm'
import { notFound } from 'next/navigation'
import { getUserPreferences } from '@/lib/preferences/read'

export default async function AdminProfilePage() {
  const session = await requireAdminOrStaff()
  let user:
    | { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; address: string | null; city: string | null; state: string | null; zip: string | null }
    | undefined

  try {
    ;[user] = await db.select().from(users).where(eq(users.id, session.user.id))
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
      ?? (error as { cause?: { code?: string } } | null)?.cause?.code
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (code !== '42703' && !message.includes('address') && !message.includes('city') && !message.includes('state') && !message.includes('zip')) {
      throw error
    }

    ;[user] = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, session.user.id))
      .then(rows => rows.map(row => ({ ...row, address: null, city: null, state: null, zip: null })))
  }

  if (!user) notFound()
  const preferences = await getUserPreferences(session.user.id)

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-muted-foreground mt-1">Update your name, email, phone number, and address</p>
      </div>
      <SimpleProfileForm user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, address: user.address, city: user.city, state: user.state, zip: user.zip }} preferences={preferences} />
    </div>
  )
}
