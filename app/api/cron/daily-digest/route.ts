import { NextRequest, NextResponse } from 'next/server'
import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { commissions, customerAccounts, salesMembers, users } from '@/db/schema'
import { postGoogleChatCard } from '@/lib/google-chat/webhook'
import { sendSalesRepDigestEmail } from '@/lib/resend/client'
import { getReorderFollowUps } from '@/lib/sales/reorder-follow-ups'

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
      const overdueAccounts = await db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
          nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate,
        })
        .from(customerAccounts)
        .where(and(
          eq(customerAccounts.assignedSalesRepId, member.memberId),
          lt(customerAccounts.nextRequiredVisitDate, now),
        ))

      const in7d = new Date(now)
      in7d.setDate(in7d.getDate() + 7)

      const dueSoonAccounts = await db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
          nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate,
        })
        .from(customerAccounts)
        .where(and(
          eq(customerAccounts.assignedSalesRepId, member.memberId),
          sql`${customerAccounts.nextRequiredVisitDate} >= ${now.toISOString()} AND ${customerAccounts.nextRequiredVisitDate} <= ${in7d.toISOString()}`,
        ))

      const assignedAccounts = await db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.assignedSalesRepId, member.memberId))

      const reorderFollowUps = (await getReorderFollowUps(assignedAccounts))
        .slice(0, 5)
        .map(item => `${item.companyName} - ${item.reason}`)

      const [pendingRow] = await db
        .select({
          total: sql<number>`coalesce(sum(${commissions.amount}::numeric), 0)::float`.as('total'),
        })
        .from(commissions)
        .where(and(
          eq(commissions.salesMemberId, member.memberId),
          eq(commissions.status, 'pending'),
        ))

      const pendingCommissions = pendingRow?.total ?? 0

      await sendSalesRepDigestEmail({
        to: member.userEmail,
        repName: member.userName ?? 'Sales Rep',
        overdueAccounts: overdueAccounts.map(account => account.companyName),
        dueSoonAccounts: dueSoonAccounts.map(account => account.companyName),
        reorderFollowUps,
        pendingCommissions,
      })

      sent++
    } catch (error) {
      console.error(`Digest email failed for ${member.userEmail}:`, error)
      failed++
    }
  }

  if (failed > 0) {
    await postGoogleChatCard(
      'Cron Failure - daily-digest',
      `${failed} of ${members.length} digest email(s) failed to send. Check Vercel logs for details.`,
    ).catch(() => {})
  }

  return NextResponse.json({ sent, failed, total: members.length })
}
