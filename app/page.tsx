import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getDashboardForRoles } from '@/lib/auth/view-as'
import { MarketingPage } from '@/components/marketing/MarketingPage'

export default async function HomePage() {
  const session = await auth()

  if (session) {
    const role = (session.user as { role?: string }).role
    const roles = (session.user as { roles?: string[] }).roles ?? (role ? [role] : [])
    redirect(getDashboardForRoles(roles, role))
  }

  return <MarketingPage />
}
