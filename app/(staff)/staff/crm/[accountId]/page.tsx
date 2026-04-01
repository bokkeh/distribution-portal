import { auth } from '@/lib/auth/config'
import { AccountRecordPage } from '@/components/crm/AccountRecordPage'

export default async function StaffAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { accountId } = await params
  const { tab } = await searchParams
  const session = await auth()
  const currentUserRoles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : [])

  return (
    <AccountRecordPage
      accountId={accountId}
      mode="staff"
      currentUserId={session?.user?.id}
      currentUserRoles={currentUserRoles}
      selectedTab={tab}
    />
  )
}
