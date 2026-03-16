import { completeRoleOnboarding } from '@/actions/onboarding'
import { requireRole } from '@/lib/auth/session'
import { getUserPreferences } from '@/lib/preferences/read'
import { RoleWelcomeCard } from '@/components/onboarding/RoleWelcomeCard'
import { redirect } from 'next/navigation'

export default async function DriverWelcomePage() {
  const session = await requireRole('driver', 'admin')
  const roles = session.user.roles ?? [session.user.role]

  if (roles.includes('admin')) {
    redirect('/driver/deliveries')
  }

  const preferences = await getUserPreferences(session.user.id)
  if (preferences.driverOnboardingCompletedAt) {
    redirect('/driver/deliveries')
  }

  return (
    <RoleWelcomeCard
      eyebrow="Welcome"
      title="Welcome to the driver portal"
      description="This is where you’ll review routes, open maps, upload proof of delivery, and stay current on delivery changes."
      bullets={[
        <span key="route">Start from My Deliveries to see route order, stop details, and customer contact info.</span>,
        <span key="proof">Upload proof and shelf photos from each stop so staff can confirm delivery completion quickly.</span>,
        <span key="profile">Keep your profile and vehicle details current so assignments and route planning stay accurate.</span>,
      ]}
      formAction={completeRoleOnboarding.bind(null, 'driver')}
      primaryLabel="Continue to My Deliveries"
      secondaryHref="/driver/profile"
      secondaryLabel="Review Driver Profile"
    />
  )
}
