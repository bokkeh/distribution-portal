import { redirect } from 'next/navigation'
import { requireFeature } from '@/lib/auth/session'
import { getUserPreferences } from '@/lib/preferences/read'

export default async function TasterIndexPage() {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin')) {
    const preferences = await getUserPreferences(session.user.id)
    if (!preferences.tasterOnboardingCompletedAt) {
      redirect('/taster/welcome')
    }
  }
  redirect('/taster/dashboard')
}
