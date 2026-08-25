import { requireFeature } from '@/lib/auth/session'
import { PullThroughDashboard } from '@/components/pull-through/PullThroughDashboard'
import { resolvePullThroughScope } from '@/lib/pull-through/data'

export default async function AdminPullThroughPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireFeature('crm', 'admin', 'sales_manager')
  const scope = await resolvePullThroughScope(session)
  const params = await searchParams

  return <PullThroughDashboard scope={scope} searchParams={params} showTeamLinks />
}
