import { requireRole } from '@/lib/auth/session'
import { MemberProfileView } from '@/components/progression/MemberProfileView'

export default async function SalesTeamMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireRole('sales_manager', 'admin')
  const { userId } = await params
  return <MemberProfileView userId={userId} backHref="/sales/team/roster" />
}
