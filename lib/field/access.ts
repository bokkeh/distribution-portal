import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, salesMembers } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'

export async function fieldContext() {
  const session = await requireRole('admin', 'staff', 'sales_manager', 'sales_rep')
  const managesAll = session.user.roles.some(role => ['admin', 'staff', 'sales_manager'].includes(role))
  const [member] = await db.select({ id: salesMembers.id, status: salesMembers.status }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
  if (!managesAll && (!member || member.status !== 'active')) throw new Error('An active sales profile is required. Ask an administrator to check your access.')
  return { session, managesAll, member }
}

export async function fieldAccount(accountId: string) {
  const context = await fieldContext()
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  if (!account || (!context.managesAll && account.assignedSalesRepId !== context.member?.id)) throw new Error('You do not have access to this account.')
  return { ...context, account }
}
