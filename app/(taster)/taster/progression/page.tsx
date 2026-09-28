import { requireAuth } from '@/lib/auth/session'
import { MemberProfileView } from '@/components/progression/MemberProfileView'

export default async function MyProgressionPage() {
  const session = await requireAuth()
  return <MemberProfileView userId={session.user.id} />
}
