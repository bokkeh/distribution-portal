import { db } from '@/db'
import { users, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { getAccountPreferences, getUserPreferences } from '@/lib/preferences/read'
import { getCRMAccountDetail } from '@/lib/crm/account-read'

export default async function CustomerProfilePage() {
  const session = await requireRole('customer')

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.user.id))
  const [basicAccount, preferences] = await Promise.all([
    db
      .select({
        id: customerAccounts.id,
        notificationPreference: customerAccounts.notificationPreference,
        notificationPhone: customerAccounts.notificationPhone,
      })
      .from(customerAccounts)
      .where(eq(customerAccounts.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getUserPreferences(session.user.id),
  ])
  const [account, accountPrefs] = await Promise.all([
    basicAccount ? getCRMAccountDetail(basicAccount.id) : Promise.resolve(null),
    basicAccount ? getAccountPreferences(basicAccount.id, basicAccount.notificationPreference) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and delivery preferences</p>
      </div>

      <ProfileForm
        user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, preferences }}
        account={account ? { ...account, preferences: accountPrefs ?? undefined } : null}
      />
    </div>
  )
}
