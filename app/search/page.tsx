import Link from 'next/link'
import { desc, eq, ilike, or, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/session'
import { db } from '@/db'
import { customerAccounts, deliveries, orders, smsMessages, tastings, users } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

function roleBasePath(roles: string[]) {
  if (roles.includes('admin')) return '/admin/dashboard'
  if (roles.includes('staff')) return '/staff/dashboard'
  if (roles.includes('customer')) return '/customer/dashboard'
  if (roles.includes('driver')) return '/driver/deliveries'
  if (roles.includes('taster')) return '/taster/tastings'
  return ''
}

export default async function PortalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await requireAuth()
  const roles = session.user.roles ?? [session.user.role]
  const base = roleBasePath(roles)
  const { q } = await searchParams
  const query = (q || '').trim()

  if (!query) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="mt-2 text-sm text-slate-500">Use the search bar to find accounts, orders, users, deliveries, tastings, and inbox threads.</p>
      </div>
    )
  }

  const like = `%${query}%`
  const [accounts, orderRows, userRows, deliveryRows, tastingRows, inboxRows] = await Promise.all([
    db.select({ id: customerAccounts.id, name: customerAccounts.companyName, city: customerAccounts.city })
      .from(customerAccounts)
      .where(or(ilike(customerAccounts.companyName, like), ilike(customerAccounts.contactName, like)))
      .limit(8),
    db.select({ id: orders.id, status: orders.status, createdAt: orders.createdAt })
      .from(orders)
      .where(sql`cast(${orders.id} as text) ilike ${like}`)
      .orderBy(desc(orders.createdAt))
      .limit(8),
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(ilike(users.name, like), ilike(users.email, like)))
      .limit(8),
    db.select({ id: deliveries.id, date: deliveries.weekStartDate, status: deliveries.status })
      .from(deliveries)
      .where(sql`cast(${deliveries.id} as text) ilike ${like}`)
      .limit(8),
    db.select({ id: tastings.id, name: tastings.eventName, scheduledAt: tastings.scheduledAt })
      .from(tastings)
      .where(ilike(tastings.eventName, like))
      .orderBy(desc(tastings.scheduledAt))
      .limit(8),
    db.select({ phone: smsMessages.phoneNumber, body: smsMessages.body, createdAt: smsMessages.createdAt })
      .from(smsMessages)
      .where(or(ilike(smsMessages.phoneNumber, like), ilike(smsMessages.body, like), ilike(smsMessages.contactName, like)))
      .orderBy(desc(smsMessages.createdAt))
      .limit(8),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search Results</h1>
        <p className="mt-1 text-sm text-slate-500">Showing results for "{query}"</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {accounts.length ? accounts.map((account) => (
              <Link key={account.id} href={`${base.replace(/\/dashboard$|\/deliveries$|\/tastings$/, '')}/crm/${account.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <p className="font-medium text-slate-900">{account.name}</p>
                <p className="text-sm text-slate-500">{account.city ?? 'No city on file'}</p>
              </Link>
            )) : <p className="text-sm text-slate-500">No account matches.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {orderRows.length ? orderRows.map((order) => (
              <Link key={order.id} href={`${base.replace(/\/dashboard$|\/deliveries$|\/tastings$/, '')}/orders/${order.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                  <Badge variant="secondary">{order.status}</Badge>
                </div>
                <p className="text-sm text-slate-500" suppressHydrationWarning>{formatDate(order.createdAt)}</p>
              </Link>
            )) : <p className="text-sm text-slate-500">No order matches.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {userRows.length ? userRows.map((user) => (
              <Link key={user.id} href={`/admin/users/${user.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </Link>
            )) : <p className="text-sm text-slate-500">No user matches.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Deliveries</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deliveryRows.length ? deliveryRows.map((delivery) => (
              <Link key={delivery.id} href={`/admin/deliveries/${delivery.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">Delivery #{delivery.id.slice(0, 8).toUpperCase()}</p>
                  <Badge variant="secondary">{delivery.status}</Badge>
                </div>
                <p className="text-sm text-slate-500">{delivery.date}</p>
              </Link>
            )) : <p className="text-sm text-slate-500">No delivery matches.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tastings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {tastingRows.length ? tastingRows.map((tasting) => (
              <Link key={tasting.id} href={`/taster/tastings/${tasting.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <p className="font-medium text-slate-900">{tasting.name}</p>
                <p className="text-sm text-slate-500" suppressHydrationWarning>{formatDate(tasting.scheduledAt)}</p>
              </Link>
            )) : <p className="text-sm text-slate-500">No tasting matches.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inbox Threads</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inboxRows.length ? inboxRows.map((thread, index) => (
              <Link key={`${thread.phone}-${index}`} href={`${base.replace(/\/dashboard$|\/deliveries$|\/tastings$/, '')}/inbox?phone=${encodeURIComponent(thread.phone)}`} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <p className="font-medium text-slate-900">{thread.phone}</p>
                <p className="line-clamp-2 text-sm text-slate-500">{thread.body}</p>
              </Link>
            )) : <p className="text-sm text-slate-500">No inbox thread matches.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
