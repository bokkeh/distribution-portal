import { completeRoleOnboarding } from '@/actions/onboarding'
import { requireFeature } from '@/lib/auth/session'
import { getUserPreferences } from '@/lib/preferences/read'
import { RoleWelcomeCard } from '@/components/onboarding/RoleWelcomeCard'
import { redirect } from 'next/navigation'

export default async function TasterWelcomePage() {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const roles = session.user.roles ?? [session.user.role]

  if (roles.includes('admin')) {
    redirect('/taster/tastings')
  }

  const preferences = await getUserPreferences(session.user.id)
  if (preferences.tasterOnboardingCompletedAt) {
    redirect('/taster/tastings')
  }

  return (
    <RoleWelcomeCard
      eyebrow="Welcome"
      title="Welcome to the taster portal"
      description="This is where you’ll confirm assignments, check in to tastings, submit reports, and track payouts."
      bullets={[
        <span key="assign">New tasting assignments arrive here first. Confirm or decline them as soon as possible.</span>,
        <span key="report">Use the tasting detail page to check in, submit bottle counts, and send your final report.</span>,
        <span key="pay">Payouts and Stripe setup live in your profile and payout screens.</span>,
      ]}
      formAction={completeRoleOnboarding.bind(null, 'taster')}
      primaryLabel="Continue to My Tastings"
      secondaryHref="/taster/profile"
      secondaryLabel="Review Profile Settings"
    />
  )
}
