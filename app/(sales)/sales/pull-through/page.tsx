import { requireRole } from '@/lib/auth/session'
import { PullThroughDashboard } from '@/components/pull-through/PullThroughDashboard'
import { resolvePullThroughScope } from '@/lib/pull-through/data'

export default async function SalesPullThroughPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const scope = await resolvePullThroughScope(session)
  const params = await searchParams

  // Reps and managers see only the accounts they already own in the CRM.
  return <PullThroughDashboard scope={scope} searchParams={params} showTeamLinks={false} />
}
