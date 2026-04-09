import { auth } from '@/lib/auth/config'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { customerAccounts, salesMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { AccountRecordPage } from '@/components/crm/AccountRecordPage'

export default async function SalesAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { accountId } = await params
  const { tab } = await searchParams
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const currentUserRoles = session.user.roles ?? (session.user.role ? [session.user.role] : [])
  const canManageAny = currentUserRoles.includes('admin') || currentUserRoles.includes('sales_manager')

  const [account] = await db
    .select({
      id: customerAccounts.id,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) notFound()

  if (!canManageAny) {
    const [member] = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member || account.assignedSalesRepId !== member.id) {
      notFound()
    }
  }

  const fullSession = await auth()
  const effectiveRoles = fullSession?.user?.roles ?? (fullSession?.user?.role ? [fullSession.user.role] : currentUserRoles)

  return (
    <AccountRecordPage
      accountId={accountId}
      mode="sales"
      currentUserId={fullSession?.user?.id ?? session.user.id}
      currentUserRoles={effectiveRoles}
      selectedTab={tab}
    />
  )
}
