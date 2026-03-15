import { db } from '@/db'
import { orders, invoices, customerAccounts, smsMessages } from '@/db/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ShoppingCart, FileText, DollarSign, Package, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default async function CustomerDashboard() {
  const session = await requireRole('customer')

  // Get customer account
  const [account] = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Account not found. Please contact AHAWC support.</p>
      </div>
    )
  }

  const [totalOrders, outstandingInvoices, recentOrders, openOrders, deliveryEta, messageCount] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(eq(orders.customerId, account.id)),
    db.select({ total: sql<string>`COALESCE(SUM(total), 0)` }).from(invoices).where(eq(invoices.customerId, account.id)),
    db.select({ id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, createdAt: orders.createdAt })
      .from(orders).where(eq(orders.customerId, account.id)).orderBy(desc(orders.createdAt)).limit(5),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(and(eq(orders.customerId, account.id), inArray(orders.status, ['pending', 'confirmed']))),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(and(eq(orders.customerId, account.id), eq(orders.shippingStatus, 'out_for_delivery'))),
    db.select({ count: sql<number>`COUNT(*)` }).from(smsMessages).where(eq(smsMessages.phoneNumber, account.pocPhone || account.businessPhone || account.phone || '')),
  ])
  const supportSmsNumber = process.env.TELNYX_FROM_NUMBER

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'warning', confirmed: 'info', fulfilled: 'success', cancelled: 'destructive',
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {session.user.name}!</h1>
          <p className="text-muted-foreground mt-1">{account.companyName}</p>
        </div>
        <Link href="/customer/products">
          <Button><Package className="w-4 h-4 mr-2" />Order Products</Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders[0]?.count ?? 0}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoices Due</p>
                <p className="text-2xl font-bold">{formatCurrency(outstandingInvoices[0]?.total ?? '0')}</p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Orders</p>
                <p className="text-2xl font-bold">{openOrders[0]?.count ?? 0}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delivery ETA</p>
                <p className="text-2xl font-bold">{deliveryEta[0]?.count ? 'Active' : 'Not out'}</p>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages</p>
                <p className="text-2xl font-bold">{messageCount[0]?.count ?? 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Delivery Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p><span className="font-medium text-slate-900">Preferred days:</span> {account.preferredDeliveryDays || 'Not set'}</p>
            <p><span className="font-medium text-slate-900">Preferred times:</span> {account.preferredDeliveryTimes || 'Not set'}</p>
            <p><span className="font-medium text-slate-900">Notification preference:</span> {account.notificationPreference || 'email'}</p>
            <Link href="/customer/profile"><Button variant="outline" size="sm">Update Preferences</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Reach the team directly if you need delivery help, product help, or invoice support.</p>
            <div className="flex flex-wrap gap-2">
              {supportSmsNumber ? (
                <a href={`sms:${supportSmsNumber}`}>
                  <Button variant="outline" size="sm">Text Support</Button>
                </a>
              ) : null}
              <a href="mailto:support@ahawc.com">
                <Button variant="ghost" size="sm">Email Support</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Orders</CardTitle>
          <Link href="/customer/orders"><Button variant="ghost" size="sm">View all</Button></Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-muted-foreground">No orders yet.</p>
              <Link href="/customer/products"><Button className="mt-4">Browse Products</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">Order #{o.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)} · {o.orderType}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusColor[o.status]}>{o.status}</Badge>
                    <span className="font-semibold text-sm">{formatCurrency(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
