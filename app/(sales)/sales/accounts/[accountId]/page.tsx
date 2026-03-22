import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts, orders, orderItems, invoices } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, MapPin, Phone, Mail, Clock, AlertCircle, CheckCircle2, ArrowLeft, Package, FileText, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { CheckInModal } from './CheckInModal'
import { PhoneActions } from '@/components/shared/PhoneActions'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-700 border-red-200 bg-red-50',
  medium: 'text-blue-700 border-blue-200 bg-blue-50',
  low: 'text-slate-600 border-slate-200 bg-slate-50',
}

export default async function SalesAccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await params
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  const [account] = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) notFound()

  // Sales reps can only see their own accounts; managers/admins can see any
  const isRep = session.user.roles?.includes('sales_rep') && !session.user.roles?.includes('sales_manager') && !session.user.roles?.includes('admin')
  if (isRep && member && account.assignedSalesRepId !== member.id) notFound()

  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, accountId))
    .orderBy(desc(orders.createdAt))
    .limit(20)

  // Item counts per order
  const orderIds = recentOrders.map(o => o.id)
  const itemCounts = orderIds.length > 0
    ? await db
        .select({
          orderId: orderItems.orderId,
          itemCount: sql<number>`sum(${orderItems.quantity}::numeric)::int`.as('item_count'),
        })
        .from(orderItems)
        .where(sql`${orderItems.orderId} = ANY(ARRAY[${sql.raw(orderIds.map(id => `'${id}'`).join(','))}]::uuid[])`)
        .groupBy(orderItems.orderId)
    : []

  // Invoice numbers per order
  const invoicesByOrder = orderIds.length > 0
    ? await db
        .select({ orderId: invoices.orderId, invoiceNumber: invoices.invoiceNumber, id: invoices.id })
        .from(invoices)
        .where(sql`${invoices.orderId} = ANY(ARRAY[${sql.raw(orderIds.map(id => `'${id}'`).join(','))}]::uuid[])`)
    : []

  const itemCountByOrder = new Map(itemCounts.map(r => [r.orderId, r.itemCount]))
  const invoiceByOrder = new Map(invoicesByOrder.map(r => [r.orderId!, { number: r.invoiceNumber, id: r.id }]))

  const now = new Date()
  const isOverdue = account.nextRequiredVisitDate && new Date(account.nextRequiredVisitDate) < now
  const daysUntilVisit = account.nextRequiredVisitDate
    ? Math.ceil((new Date(account.nextRequiredVisitDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isDueSoon = !isOverdue && daysUntilVisit !== null && daysUntilVisit <= 7

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  const totalRevenue = recentOrders.reduce((s, o) => s + parseFloat(o.total ?? '0'), 0)

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/sales/accounts" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          My Accounts
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{account.companyName}</h1>
            {account.contactName && (
              <p className="text-slate-500 mt-0.5">{account.contactName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {account.accountPriority && (
              <Badge variant="outline" className={`capitalize ${PRIORITY_COLORS[account.accountPriority] ?? ''}`}>
                {account.accountPriority} priority
              </Badge>
            )}
            {isOverdue ? (
              <Badge variant="destructive">Visit Overdue</Badge>
            ) : isDueSoon ? (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Due in {daysUntilVisit}d</Badge>
            ) : (
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Visit Current
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: account info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(account.address || account.city) && (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    {account.address && <p>{account.address}</p>}
                    {(account.city || account.state || account.zip) && (
                      <p>{[account.city, account.state, account.zip].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
              {account.phone && (
                <div className="flex items-start gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 mt-1.5 shrink-0" />
                  <PhoneActions phone={account.phone} name={account.companyName} accountId={account.id} />
                </div>
              )}
              {account.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${account.email}`} className="hover:text-blue-600 truncate">{account.email}</a>
                </div>
              )}
              {account.accountType && (
                <div className="pt-2 border-t">
                  <span className="text-xs text-slate-400">Type</span>
                  <p className="font-medium capitalize">{account.accountType.replace('_', ' ')}</p>
                </div>
              )}
              {account.businessType && (
                <div>
                  <span className="text-xs text-slate-400">Business Type</span>
                  <p className="font-medium">{account.businessType}</p>
                </div>
              )}
              {account.paymentTerms && (
                <div>
                  <span className="text-xs text-slate-400">Payment Terms</span>
                  <p className="font-medium">{account.paymentTerms}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visit tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Visit Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-400">Visit Frequency</span>
                <p className="font-medium">Every {account.visitFrequency ?? 30} days</p>
              </div>
              {account.lastVisitDate ? (
                <div>
                  <span className="text-xs text-slate-400">Last Visit</span>
                  <p className="font-medium">{new Date(account.lastVisitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              ) : (
                <div>
                  <span className="text-xs text-slate-400">Last Visit</span>
                  <p className="text-slate-400 italic">Never visited</p>
                </div>
              )}
              {account.nextRequiredVisitDate && (
                <div>
                  <span className="text-xs text-slate-400">Next Required Visit</span>
                  <p className={`font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-slate-800'}`}>
                    {new Date(account.nextRequiredVisitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOverdue && ' (overdue)'}
                    {isDueSoon && ` (in ${daysUntilVisit} days)`}
                  </p>
                </div>
              )}

              {member && account.assignedSalesRepId === member.id && (
                <div className="pt-2">
                  <CheckInModal
                    customerId={account.id}
                    salesMemberId={member.id}
                    companyName={account.companyName}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* POC */}
          {(account.pocName || account.pocPhone || account.pocEmail) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Point of Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {account.pocName && <p className="font-medium">{account.pocName}</p>}
                {account.pocPhone && (
                  <div className="flex items-start gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 mt-1.5 shrink-0" />
                    <PhoneActions phone={account.pocPhone} name={account.pocName ?? account.companyName} accountId={account.id} />
                  </div>
                )}
                {account.pocEmail && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`mailto:${account.pocEmail}`} className="hover:text-blue-600 truncate">{account.pocEmail}</a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: orders */}
        <div className="lg:col-span-2 space-y-4">
          {/* Revenue summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-500">Total Revenue (recent)</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-500">Orders Placed</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{recentOrders.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Order history timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" />
                Order History
                <span className="ml-auto text-xs font-normal text-slate-400">{recentOrders.length} orders</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No orders yet for this account.</p>
              ) : (
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100" />
                  <div className="space-y-0">
                    {recentOrders.map((order, idx) => {
                      const inv = invoiceByOrder.get(order.id)
                      const items = itemCountByOrder.get(order.id) ?? 0
                      const dotColor =
                        order.status === 'fulfilled' ? 'bg-green-500' :
                        order.status === 'cancelled' ? 'bg-red-400' :
                        order.status === 'confirmed' ? 'bg-blue-500' :
                        'bg-amber-400'
                      return (
                        <div key={order.id} className={`flex items-start gap-4 px-4 py-3.5 ${idx < recentOrders.length - 1 ? 'border-b border-slate-50' : ''}`}>
                          {/* Timeline dot */}
                          <div className="relative z-10 shrink-0 mt-0.5">
                            <div className={`w-4 h-4 rounded-full border-2 border-white ${dotColor} shadow-sm`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800">
                                {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize ${
                                  order.status === 'fulfilled' ? 'text-green-700 border-green-300 bg-green-50' :
                                  order.status === 'cancelled' ? 'text-red-600 border-red-300 bg-red-50' :
                                  order.status === 'confirmed' ? 'text-blue-700 border-blue-300 bg-blue-50' :
                                  'text-amber-700 border-amber-300 bg-amber-50'
                                }`}
                              >
                                {order.status}
                              </Badge>
                              {order.orderType === 'sample' && (
                                <Badge variant="outline" className="text-xs text-violet-700 border-violet-300 bg-violet-50">Sample</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                              {items > 0 && <span><ShoppingCart className="w-3 h-3 inline mr-0.5" />{items} items</span>}
                              <span className="capitalize">{order.shippingStatus.replace(/_/g, ' ')}</span>
                              {inv && (
                                <span className="flex items-center gap-0.5">
                                  <FileText className="w-3 h-3" />
                                  Inv #{inv.number}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-slate-900 shrink-0 text-sm">{fmt(parseFloat(order.total ?? '0'))}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hours / preferences */}
          {(account.hoursOfOperation || account.preferredDeliveryDays) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Delivery Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {account.hoursOfOperation && (
                  <div>
                    <span className="text-xs text-slate-400">Hours of Operation</span>
                    <p className="font-medium">{account.hoursOfOperation}</p>
                  </div>
                )}
                {account.preferredDeliveryDays && (
                  <div>
                    <span className="text-xs text-slate-400">Preferred Delivery Days</span>
                    <p className="font-medium">{account.preferredDeliveryDays}</p>
                  </div>
                )}
                {account.preferredDeliveryTimes && (
                  <div>
                    <span className="text-xs text-slate-400">Preferred Times</span>
                    <p className="font-medium">{account.preferredDeliveryTimes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
