import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts, orders } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, MapPin, Phone, Mail, Clock, AlertCircle, CheckCircle2, ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'
import { LogVisitButton } from './LogVisitButton'
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
    .limit(10)

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
                  <PhoneActions phone={account.phone} name={account.companyName} />
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
                  <LogVisitButton customerId={account.id} salesMemberId={member.id} />
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
                    <PhoneActions phone={account.pocPhone} name={account.pocName ?? account.companyName} />
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

          {/* Orders list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No orders yet for this account.</p>
              ) : (
                <div className="space-y-0">
                  {recentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between py-3 border-b last:border-0 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800">
                            {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              order.status === 'fulfilled' ? 'text-green-700 border-green-300' :
                              order.status === 'cancelled' ? 'text-red-700 border-red-300' :
                              'text-blue-700 border-blue-300'
                            }`}
                          >
                            {order.status}
                          </Badge>
                          {order.orderType === 'sample' && (
                            <Badge variant="outline" className="text-xs text-violet-700 border-violet-300">Sample</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">{order.shippingStatus.replace('_', ' ')}</p>
                      </div>
                      <p className="font-semibold text-slate-900 shrink-0">{fmt(parseFloat(order.total ?? '0'))}</p>
                    </div>
                  ))}
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
