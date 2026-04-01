import { db } from '@/db'
import { customerAccounts, contacts, deliveries, deliveryStops, invoices, orders, smsMessages, tastings } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { AccountEditForm } from '@/components/crm/AccountEditForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { syncToHubSpot } from '@/actions/crm'
import { getCRMAccountDetail } from '@/lib/crm/account-read'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, FileText, Truck, MessageSquare, CalendarDays, RefreshCcw,
} from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { ViewAsAccountButton } from '@/components/admin/ViewAsAccountButton'
import {
  getAccountActivityFeed,
  getAccountInventoryOnHand,
  getAccountNotes,
  getAvailableInventoryProducts,
} from '@/lib/crm/account-detail-data'
import { AccountActivityCard } from '@/components/crm/AccountActivityCard'
import { AccountDetailsCard } from '@/components/crm/AccountDetailsCard'
import { AccountInventoryOnHandCard } from '@/components/crm/AccountInventoryOnHandCard'
import { AccountNotesCard } from '@/components/crm/AccountNotesCard'

export default async function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params

  const session = await auth()
  const currentUserRoles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : [])
  const canSwitchView = currentUserRoles.includes('admin')

  const account = await getCRMAccountDetail(accountId)
  if (!account) notFound()

  const accountPhones = [account.phone, account.businessPhone, account.pocPhone].filter(Boolean) as string[]

  const [accountContactsResult, recentOrdersResult, recentInvoicesResult, orderCountResult, recentDeliveriesResult, recentTextsResult, recentTastingsResult, accountNotes, inventoryOnHand, inventoryProducts, activityFeed] = await Promise.allSettled([
    db.select({
      id: contacts.id,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      phone: contacts.phone,
      isPrimary: contacts.isPrimary,
    }).from(contacts).where(eq(contacts.customerId, accountId)).orderBy(desc(contacts.createdAt)),
    db.select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    }).from(orders).where(eq(orders.customerId, accountId)).orderBy(desc(orders.createdAt)).limit(8),
    db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      dueDate: invoices.dueDate,
      total: invoices.total,
      status: invoices.status,
    }).from(invoices).where(eq(invoices.customerId, accountId)).orderBy(desc(invoices.createdAt)).limit(5),
    db.select({ total: count() }).from(orders).where(eq(orders.customerId, accountId)),
    db.select({
      deliveryId: deliveries.id,
      status: deliveries.status,
      weekStartDate: deliveries.weekStartDate,
      stopStatus: deliveryStops.status,
      completedAt: deliveryStops.completedAt,
    })
      .from(deliveryStops)
      .innerJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id))
      .where(eq(deliveryStops.customerId, accountId))
      .orderBy(desc(deliveries.createdAt))
      .limit(6),
    accountPhones.length
      ? db.select({
          id: smsMessages.id,
          direction: smsMessages.direction,
          body: smsMessages.body,
          createdAt: smsMessages.createdAt,
          phoneNumber: smsMessages.phoneNumber,
        }).from(smsMessages).where(eq(smsMessages.phoneNumber, accountPhones[0]!)).orderBy(desc(smsMessages.createdAt)).limit(6)
      : Promise.resolve([]),
    db.select({
      id: tastings.id,
      eventName: tastings.eventName,
      status: tastings.status,
      scheduledAt: tastings.scheduledAt,
      endAt: tastings.endAt,
    }).from(tastings).where(eq(tastings.customerId, accountId)).orderBy(desc(tastings.scheduledAt)).limit(6),
    getAccountNotes(accountId),
    getAccountInventoryOnHand(accountId),
    getAvailableInventoryProducts(),
    getAccountActivityFeed(accountId, 'admin'),
  ])

  const accountContacts = accountContactsResult.status === 'fulfilled' ? accountContactsResult.value : []
  const recentOrders = recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : []
  const recentInvoices = recentInvoicesResult.status === 'fulfilled' ? recentInvoicesResult.value : []
  const orderCount = orderCountResult.status === 'fulfilled' ? orderCountResult.value[0] : { total: 0 }
  const recentDeliveries = recentDeliveriesResult.status === 'fulfilled' ? recentDeliveriesResult.value : []
  const recentTexts = recentTextsResult.status === 'fulfilled' ? recentTextsResult.value : []
  const recentTastings = recentTastingsResult.status === 'fulfilled' ? recentTastingsResult.value : []
  const notes = accountNotes.status === 'fulfilled' ? accountNotes.value : []
  const inventoryItems = inventoryOnHand.status === 'fulfilled' ? inventoryOnHand.value : []
  const productOptions = inventoryProducts.status === 'fulfilled' ? inventoryProducts.value : []
  const activityItems = activityFeed.status === 'fulfilled' ? activityFeed.value : []

  const creditAvailable = Math.max(0, Number(account.creditLimit ?? 0) - Number(account.balance ?? 0))
  const accountHealthSignals = [
    Number(account.balance ?? 0) > 0 ? { label: 'Outstanding balance', ok: false } : { label: 'No outstanding balance', ok: true },
    recentTexts.some((message) => message.direction === 'inbound') ? { label: 'Open text activity', ok: false } : { label: 'No open text activity', ok: true },
    recentDeliveries.some((delivery) => delivery.stopStatus === 'failed') ? { label: 'Delivery issues on file', ok: false } : { label: 'Delivery history stable', ok: true },
    recentOrders.length === 0 ? { label: 'No recent orders', ok: false } : { label: 'Recent ordering activity', ok: true },
    recentTastings.some((tasting) => tasting.status === 'completed') ? { label: 'Tasting activity on account', ok: true } : { label: 'No completed tastings yet', ok: true },
  ]
  const healthySignals = accountHealthSignals.filter((signal) => signal.ok).length
  const healthScore = Math.round((healthySignals / accountHealthSignals.length) * 100)

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/crm">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{account.companyName}</h1>
            <Badge variant="secondary">{account.paymentTerms ?? 'NET30'}</Badge>
            {account.hubspotContactId
              ? <Badge variant="success">HubSpot Synced</Badge>
              : <Badge variant="outline">Not synced</Badge>}
          </div>
          {(account.city || account.state) && (
            <p className="text-sm text-muted-foreground mt-1">
              {[account.city, account.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canSwitchView && (
            <ViewAsAccountButton accountId={account.id} companyName={account.companyName} />
          )}
          <form action={syncToHubSpot.bind(null, account.id)}>
            <Button variant="outline" size="sm" type="submit">
              <RefreshCw className="w-4 h-4 mr-2" />Sync HubSpot
            </Button>
          </form>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance Due</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(account.balance ?? '0')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit Available</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(creditAvailable.toFixed(2))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">of {formatCurrency(account.creditLimit ?? '0')} limit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold mt-1">{orderCount?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member Since</p>
            <p className="text-lg font-bold mt-1" suppressHydrationWarning>{formatDate(account.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <AccountInventoryOnHandCard accountId={account.id} items={inventoryItems} products={productOptions} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Account Details + Edit Form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Read-only summary */}
          <AccountDetailsCard account={account} mode="admin" />

          {/* Edit Form */}
          <Card id="edit-account">
            <CardHeader className="pb-3">
              <CardTitle>Edit Account</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountEditForm account={account} mode="admin" />
            </CardContent>
          </Card>

          <AccountNotesCard
            accountId={account.id}
            notes={notes}
            currentUserId={session?.user?.id}
            currentUserRoles={currentUserRoles}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Sync Status Center
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">HubSpot</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{account.hubspotContactId || account.hubspotCompanyId ? 'Connected' : 'Needs sync'}</p>
                <p className="mt-1 text-xs text-slate-500">{account.hubspotCompanyId ? `Company ${account.hubspotCompanyId}` : 'No HubSpot company linked'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">SMS</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{recentTexts.length ? 'Conversation history available' : 'No texts logged yet'}</p>
                <p className="mt-1 text-xs text-slate-500">{accountPhones[0] ?? 'No account phone on file'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Deliveries</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{recentDeliveries.length ? 'Delivery history linked' : 'No delivery history yet'}</p>
                <p className="mt-1 text-xs text-slate-500">{recentDeliveries[0] ? `Latest stop ${recentDeliveries[0].stopStatus}` : 'Awaiting first route assignment'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Account Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Health score</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{healthScore}</p>
                <p className="mt-1 text-xs text-slate-500">Based on balance, order, delivery, tasting, and SMS activity.</p>
              </div>
              <div className="space-y-2">
                {accountHealthSignals.map((signal) => (
                  <div key={signal.label} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm">
                    <span className="text-slate-700">{signal.label}</span>
                    <Badge variant={signal.ok ? 'success' : 'warning'}>{signal.ok ? 'Healthy' : 'Needs review'}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Contacts, Invoices, Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contacts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Contacts</CardTitle>
              <Link href={`/admin/crm/${account.id}/contacts`}>
                <Button variant="ghost" size="sm">Manage</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {accountContacts.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                  <Link href={`/admin/crm/${account.id}/contacts`}>
                    <Button variant="ghost" size="sm" className="mt-2">Add Contact</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {accountContacts.map(contact => (
                    <div key={contact.id} className="pb-3 border-b last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{contact.name}</p>
                        {contact.isPrimary && <Badge variant="info" className="text-xs">Primary</Badge>}
                      </div>
                      {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
                      {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                      {contact.phone && (
                        <PhoneSmsButton phone={contact.phone} recipientName={contact.name} accountId={account.id} className="text-xs" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          {recentInvoices.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />Invoices
                </CardTitle>
                <Link href={`/admin/invoices?customer=${account.id}`}>
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentInvoices.map(invoice => (
                    <div key={invoice.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                        {invoice.dueDate && (
                          <p className="text-xs text-muted-foreground">Due {formatDate(invoice.dueDate)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(invoice.total)}</p>
                        <Badge
                          variant={
                            invoice.status === 'paid' ? 'success' :
                            invoice.status === 'overdue' ? 'destructive' :
                            invoice.status === 'sent' ? 'info' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Recent Orders</CardTitle>
              <Link href={`/admin/orders/new?customer=${account.id}`}>
                <Button variant="ghost" size="sm">Create Order</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                  <Link href={`/admin/orders/new?customer=${account.id}`}>
                    <Button variant="ghost" size="sm" className="mt-2">Create Order</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map(order => (
                    <Link key={order.id} href={`/admin/orders/${order.id}`}>
                      <div className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-medium">#{order.id.slice(-8).toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
                          <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Deliveries
              </CardTitle>
              <Link href="/admin/deliveries/new">
                <Button variant="ghost" size="sm">Add Delivery</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentDeliveries.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No deliveries linked to this account yet.</p>
                  <Link href="/admin/deliveries/new">
                    <Button variant="ghost" size="sm" className="mt-2">Add Delivery</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentDeliveries.map((delivery) => (
                    <Link key={`${delivery.deliveryId}-${String(delivery.completedAt ?? delivery.weekStartDate)}`} href={`/admin/deliveries/${delivery.deliveryId}`}>
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 transition-colors hover:bg-slate-50">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Delivery {String(delivery.deliveryId).slice(-8).toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">{String(delivery.weekStartDate)} • Stop {delivery.stopStatus}</p>
                        </div>
                        <Badge variant="secondary">{delivery.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Tastings
              </CardTitle>
              <Link href={`/admin/tastings?account=${account.id}`}>
                <Button variant="ghost" size="sm">Add Tasting</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentTastings.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No tastings linked to this account yet.</p>
                  <Link href={`/admin/tastings?account=${account.id}`}>
                    <Button variant="ghost" size="sm" className="mt-2">Add Tasting</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTastings.map((tasting) => (
                    <Link key={tasting.id} href={`/taster/tastings/${tasting.id}`}>
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 transition-colors hover:bg-slate-50">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{tasting.eventName}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tasting.scheduledAt)}</p>
                        </div>
                        <Badge variant="secondary">{tasting.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Recent Texts
              </CardTitle>
              {accountPhones[0] ? <Link href={`/admin/inbox?phone=${encodeURIComponent(accountPhones[0])}`} className="text-xs font-medium text-primary hover:underline">Open thread</Link> : null}
            </CardHeader>
            <CardContent>
              {recentTexts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inbox history found for this account yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentTexts.map((message) => (
                    <div key={message.id} className="rounded-xl border border-slate-100 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant={message.direction === 'inbound' ? 'warning' : 'secondary'}>{message.direction}</Badge>
                        <span className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-700">{message.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AccountActivityCard items={activityItems} />
    </div>
  )
}
