import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { salesMembers, customerAccounts, commissions, orders, users } from '@/db/schema'
import { eq, and, lt, sql } from 'drizzle-orm'
import { sendSalesRepDigestEmail } from '@/lib/resend/client'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const threshold30d = new Date(now)
  threshold30d.setDate(threshold30d.getDate() - 30)

  // All active sales members with user info
  const members = await db
    .select({
      memberId: salesMembers.id,
      userId: salesMembers.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(salesMembers)
    .leftJoin(users, eq(salesMembers.userId, users.id))

  let sent = 0
  let failed = 0

  for (const member of members) {
    if (!member.userEmail) continue

    try {
      // Overdue accounts
      const overdueAccounts = await db
        .select({ id: customerAccounts.id, companyName: customerAccounts.companyName, nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate })
        .from(customerAccounts)
        .where(and(
          eq(customerAccounts.assignedSalesRepId, member.memberId),
          lt(customerAccounts.nextRequiredVisitDate, now),
        ))

      // Accounts due in next 7 days
      const in7d = new Date(now)
      in7d.setDate(in7d.getDate() + 7)
      const dueSoonAccounts = await db
        .select({ id: customerAccounts.id, companyName: customerAccounts.companyName, nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate })
        .from(customerAccounts)
        .where(and(
          eq(customerAccounts.assignedSalesRepId, member.memberId),
          sql`${customerAccounts.nextRequiredVisitDate} >= ${now.toISOString()} AND ${customerAccounts.nextRequiredVisitDate} <= ${in7d.toISOString()}`,
        ))

      // Accounts that haven't ordered in 30+ days (reorder follow-ups) — top 5
      const myAccountIds = await db
        .select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
        .from(customerAccounts)
        .where(eq(customerAccounts.assignedSalesRepId, member.memberId))

      const accountIds = myAccountIds.map(a => a.id)
      const reorderFollowUps: string[] = []

      if (accountIds.length > 0) {
        const lastOrderRows = await db
          .select({
            customerId: orders.customerId,
            lastOrderAt: sql<string>`max(${orders.createdAt})`.as('last_order_at'),
          })
          .from(orders)
          .where(sql`${orders.customerId} = ANY(ARRAY[${sql.raw(accountIds.map(id => `'${id}'`).join(','))}]::uuid[])`)
          .groupBy(orders.customerId)

        const lastOrderByAccount = new Map(lastOrderRows.map(r => [r.customerId, new Date(r.lastOrderAt)]))
        const accountNameMap = new Map(myAccountIds.map(a => [a.id, a.companyName]))

        for (const id of accountIds) {
          const last = lastOrderByAccount.get(id)
          if (!last || last < threshold30d) {
            reorderFollowUps.push(accountNameMap.get(id) ?? id)
            if (reorderFollowUps.length >= 5) break
          }
        }
      }

      // Pending commissions total
      const [pendingRow] = await db
        .select({ total: sql<number>`coalesce(sum(${commissions.amount}::numeric), 0)::float`.as('total') })
        .from(commissions)
        .where(and(
          eq(commissions.salesMemberId, member.memberId),
          eq(commissions.status, 'pending'),
        ))

      const pendingCommissions = pendingRow?.total ?? 0

      await sendSalesRepDigestEmail({
        to: member.userEmail,
        repName: member.userName ?? 'Sales Rep',
        overdueAccounts: overdueAccounts.map(a => a.companyName),
        dueSoonAccounts: dueSoonAccounts.map(a => a.companyName),
        reorderFollowUps,
        pendingCommissions,
      })

      sent++
    } catch (err) {
      console.error(`Digest email failed for ${member.userEmail}:`, err)
      failed++
    }
  }

  return NextResponse.json({ sent, failed, total: members.length })
}
