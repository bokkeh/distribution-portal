import Link from 'next/link'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ArrowRight, BellRing, CreditCard, FileText, MessageSquare, Package, ShoppingCart, Truck, UserCircle } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { customerAccounts, invoices, orders, smsMessages } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatOrderTypeLabel } from '@/lib/orders/status'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IndustryNewsWidget } from '@/components/news/IndustryNewsWidget'

export default async function CustomerDashboard() {
  const session = await requireRole('customer')

  const [account] = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))
    .limit(1)

  if (!account) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Account not found. Please contact AHAWC support.</p>
      </div>
    )
  }

  const supportPhone = account.pocPhone || account.businessPhone || account.phone || ''
  const supportSmsNumber = process.env.TELNYX_FROM_NUMBER || null
  const emailHref = 'mailto:sales@wishervodka.com?cc=alex@ahawc.com,kristen@ahawc.com'

  const [
    totalOrders,
    unpaidInvoices,
    overdueInvoices,
    recentOrders,
    openOrders,
    deliveryEta,
    messageCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(eq(orders.customerId, account.id)),
    db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.total}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.customerId, account.id), inArray(invoices.status, ['sent', 'overdue']))),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(and(eq(invoices.customerId, account.id), eq(invoices.status, 'overdue'))),
    db
      .select({ id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, shippingStatus: orders.shippingStatus, createdAt: orders.createdAt })
      .from(orders)
      .where(eq(orders.customerId, account.id))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(and(eq(orders.customerId, account.id), inArray(orders.status, ['pending', 'confirmed']))),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(and(eq(orders.customerId, account.id), eq(orders.shippingStatus, 'out_for_delivery'))),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(smsMessages)
      .where(eq(smsMessages.phoneNumber, supportPhone)),
  ])

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'warning',
    confirmed: 'info',
    fulfilled: 'success',
    cancelled: 'destructive',
  }

  const actionCards = [
    {
      title: 'Place an order',
      body: 'Browse the catalog, check stock, and build your next replenishment order.',
      href: '/customer/products',
      icon: Package,
    },
    {
      title: 'Review invoices',
      body: 'See invoice status, due dates, and payment history in one place.',
      href: '/customer/invoices',
      icon: CreditCard,
    },
    {
      title: 'Update profile',
      body: 'Keep delivery preferences, quiet hours, and contact info current.',
      href: '/customer/profile',
      icon: UserCircle,
    },
  ]

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Customer Portal</Badge>
              {deliveryEta[0]?.count ? <Badge variant="success">Delivery active</Badge> : null}
              {overdueInvoices[0]?.count ? <Badge variant="warning">{overdueInvoices[0].count} overdue invoice{overdueInvoices[0].count === 1 ? '' : 's'}</Badge> : null}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back, {session.user.name}.</h1>
              <p className="mt-2 text-sm text-slate-600">
                Manage orders, monitor delivery activity, and keep your account preferences up to date for {account.companyName}.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Open orders</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{openOrders[0]?.count ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">Pending or confirmed</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Invoices due</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(unpaidInvoices[0]?.total ?? '0')}</p>
                <p className="mt-1 text-xs text-slate-500">{overdueInvoices[0]?.count ?? 0} overdue</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Delivery status</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{deliveryEta[0]?.count ? 'Live' : 'Idle'}</p>
                <p className="mt-1 text-xs text-slate-500">{deliveryEta[0]?.count ? 'An order is out for delivery' : 'No active truck run'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Messages</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{messageCount[0]?.count ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">Texts logged for this account</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/customer/products">
                <Button><Package className="mr-2 h-4 w-4" />Order Products</Button>
              </Link>
              <Link href="/customer/orders">
                <Button variant="outline">Track Orders</Button>
              </Link>
              <Link href="/customer/invoices">
                <Button variant="outline">View Invoices</Button>
              </Link>
            </div>
          </div>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Delivery preferences</p>
                <p className="mt-2 font-medium text-slate-900">{account.preferredDeliveryDays || 'No preferred days saved'}</p>
                <p className="mt-1 text-xs text-slate-500">{account.preferredDeliveryTimes || 'No preferred delivery window set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Notification mode</p>
                <p className="mt-2 font-medium text-slate-900 capitalize">{account.notificationPreference || 'email'}</p>
                <p className="mt-1 text-xs text-slate-500">{supportPhone || 'No account phone saved yet'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Support</p>
                <p className="mt-2 text-sm text-slate-600">Reach the team directly if you need delivery help, product help, or invoice support.</p>
                <div className="mt-3 space-y-2 text-sm">
                  {supportSmsNumber ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Text support</p>
                      <p className="mt-1 font-medium text-slate-900">{supportSmsNumber}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email support</p>
                    <p className="mt-1 font-medium text-slate-900">sales@wishervodka.com</p>
                    <p className="mt-1 text-xs text-slate-500">CC alex@ahawc.com, kristen@ahawc.com</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Your latest activity across placed orders.</p>
            </div>
            <Link href="/customer/orders">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-muted-foreground">No orders yet.</p>
                <Link href="/customer/products"><Button className="mt-4">Browse Products</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <Link key={order.id} href={`/customer/orders/${order.id}`} className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Order #{order.id.slice(-8).toUpperCase()}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)} · {formatOrderTypeLabel(order.orderType)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={statusColor[order.status]}>{order.status}</Badge>
                        <span className="font-semibold text-sm text-slate-900">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>What Would You Like To Do?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionCards.map(card => {
              const Icon = card.icon
              return (
                <Link key={card.title} href={card.href} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{card.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{card.body}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                </Link>
              )
            })}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-slate-400" />
                <p className="font-medium text-slate-900">Need something custom?</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                For delivery changes, product questions, or invoice issues, use the support actions above or update your account preferences.
              </p>
            </div>
          </CardContent>
        </Card>

        <IndustryNewsWidget audience="customer" />
      </div>
    </div>
  )
}
