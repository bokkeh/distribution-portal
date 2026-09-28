import { requireAdminOrStaff } from '@/lib/auth/session'
import { MemberProfileView } from '@/components/progression/MemberProfileView'

export default async function MemberProgressionPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdminOrStaff()
  const { userId } = await params
  return <MemberProfileView userId={userId} backHref="/admin/team-progression/roster" />
}
