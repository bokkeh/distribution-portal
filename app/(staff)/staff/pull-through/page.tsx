import { requireFeature } from '@/lib/auth/session'
import { PullThroughDashboard } from '@/components/pull-through/PullThroughDashboard'
import { resolvePullThroughScope } from '@/lib/pull-through/data'

export default async function StaffPullThroughPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireFeature('crm', 'staff')
  const scope = await resolvePullThroughScope(session)
  const params = await searchParams

  return <PullThroughDashboard scope={scope} searchParams={params} showTeamLinks={false} />
}
