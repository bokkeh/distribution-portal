import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, salesMembers, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { QuickScheduleTasting } from '@/components/tastings/QuickScheduleTasting'
import { UpcomingTastingsList } from '@/components/tastings/TastingsPlanner'
import { getTastingsForViewWithFallback } from '@/lib/tastings/read'
import { getEasternDateKey } from '@/lib/tastings/time'
import { Card, CardContent } from '@/components/ui/card'

export default async function Page({ searchParams }: { searchParams: Promise<{ account?: string; date?: string }> }) {
  const session = await requireFeature('tastings', 'sales_rep', 'sales_manager', 'admin')
  const params = await searchParams
  const managesAll = session.user.roles.some(role => ['admin', 'sales_manager'].includes(role))
  const [member] = await db.select().from(salesMembers).where(and(eq(salesMembers.userId, session.user.id), eq(salesMembers.status, 'active'))).limit(1)
  const accounts = managesAll ? await db.select().from(customerAccounts).orderBy(customerAccounts.companyName)
    : member ? await db.select().from(customerAccounts).where(eq(customerAccounts.assignedSalesRepId, member.id)).orderBy(customerAccounts.companyName) : []
  const members = (await db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(eq(users.active, true)).orderBy(users.name))
    .filter(user => user.roles.some(role => ['admin', 'staff', 'sales_rep', 'sales_manager', 'taster'].includes(role)))
  const ids = new Set(accounts.map(account => account.id))
  const tastings = (await getTastingsForViewWithFallback({})).filter(tasting => ids.has(tasting.customerId))
  return <div className="space-y-6 p-4 sm:p-8">
    <Link href="/sales/tastings" className="text-primary hover:underline">← Tastings</Link>
    <Card className="mx-auto max-w-xl"><CardContent className="p-5"><QuickScheduleTasting accounts={accounts} members={members} initialAccountId={ids.has(params.account ?? '') ? params.account : undefined} date={params.date ?? getEasternDateKey(new Date())} /></CardContent></Card>
    <UpcomingTastingsList mode="sales" tastings={tastings} tasters={members.map(member => ({ ...member, phone: null }))} />
  </div>
}
