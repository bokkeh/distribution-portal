import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { getUserPreferences } from '@/lib/preferences/read'

export default async function DriverIndexPage() {
  const session = await requireRole('driver', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin')) {
    const preferences = await getUserPreferences(session.user.id)
    if (!preferences.driverOnboardingCompletedAt) {
      redirect('/driver/welcome')
    }
  }
  redirect('/driver/deliveries')
}
