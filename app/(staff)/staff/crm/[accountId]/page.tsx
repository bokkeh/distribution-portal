import { db } from '@/db'
import { customerAccounts, contacts, orders, invoices } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { DealStageSelect } from '@/components/crm/DealStageSelect'
import { AccountEditForm } from '@/components/crm/AccountEditForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getCRMAccountDetail } from '@/lib/crm/account-read'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, MapPin,
  Clock, User, CreditCard, Building2, FileText, Hash, TrendingUp,
} from 'lucide-react'

export default async function StaffAccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params

  const account = await getCRMAccountDetail(accountId)
  if (!account) notFound()

  const [accountContactsResult, recentOrdersResult, recentInvoicesResult, orderCountResult] = await Promise.allSettled([
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
  ])

  const accountContacts = accountContactsResult.status === 'fulfilled' ? accountContactsResult.value : []
  const recentOrders = recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : []
  const recentInvoices = recentInvoicesResult.status === 'fulfilled' ? recentInvoicesResult.value : []
  const orderCount = orderCountResult.status === 'fulfilled' ? orderCountResult.value[0] : { total: 0 }

  const creditAvailable = Math.max(0, Number(account.creditLimit ?? 0) - Number(account.balance ?? 0))
  const accountHealthSignals = [
    Number(account.balance ?? 0) > 0 ? { label: 'Outstanding balance', ok: false } : { label: 'No outstanding balance', ok: true },
    recentOrders.length === 0 ? { label: 'No recent orders', ok: false } : { label: 'Recent ordering activity', ok: true },
    recentInvoices.some((invoice) => invoice.status !== 'paid') ? { label: 'Invoices awaiting payment', ok: false } : { label: 'Invoices current', ok: true },
    accountContacts.length === 0 ? { label: 'No CRM contacts saved', ok: false } : { label: 'Contacts documented', ok: true },
  ]
  const healthScore = Math.round((accountHealthSignals.filter((signal) => signal.ok).length / accountHealthSignals.length) * 100)

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/staff/crm">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{account.companyName}</h1>
            <Badge variant="secondary">{account.paymentTerms ?? 'NET30'}</Badge>
          </div>
          {(account.city || account.state) && (
            <p className="text-sm text-muted-foreground mt-1">
              {[account.city, account.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <DealStageSelect accountId={account.id} currentStage={account.dealStage} />
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Account Details + Edit Form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Read-only summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {account.address && (
                <div className="flex gap-2 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p>{account.address}</p>
                    <p className="text-muted-foreground">{[account.city, account.state, account.zip].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}
              {account.phone && (
                <div className="flex gap-2 items-center">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <PhoneSmsButton phone={account.phone} recipientName={account.companyName} showIcon={false} className="text-sm" />
                </div>
              )}
              {account.email && (
                <div className="flex gap-2 items-center">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{account.email}</span>
                </div>
              )}
              {account.businessEmail && (
                <div className="flex gap-2 items-center">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">{account.businessEmail}</span>
                </div>
              )}
              {account.hoursOfOperation && (
                <div className="flex gap-2 items-center">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{account.hoursOfOperation}</span>
                </div>
              )}
              {account.dcAbraNumber && (
                <div className="flex gap-2 items-center">
                  <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>DC ABRA: {account.dcAbraNumber}</span>
                </div>
              )}
              {(account.pocName || account.pocEmail || account.pocPhone) && (
                <div className="flex gap-2 sm:col-span-2">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{account.pocName ?? 'POC'}</p>
                    {account.pocEmail && <p className="text-muted-foreground">{account.pocEmail}</p>}
                    {account.pocPhone && <p className="text-muted-foreground">{account.pocPhone}</p>}
                  </div>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Credit Limit: <span className="font-medium">{formatCurrency(account.creditLimit ?? '0')}</span></span>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Edit Account</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountEditForm account={account} mode="staff" />
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
              <Link href={`/staff/crm/${account.id}/contacts`}>
                <Button variant="ghost" size="sm">Manage</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {accountContacts.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                  <Link href={`/staff/crm/${account.id}/contacts`}>
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
                        <PhoneSmsButton phone={contact.phone} recipientName={contact.name} className="text-xs" />
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
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />Invoices
                </CardTitle>
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
              <Link href={`/staff/orders/new?customer=${accountId}`}>
                <Button variant="ghost" size="sm">Create Order</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                  <Link href={`/staff/orders/new?customer=${accountId}`}>
                    <Button variant="ghost" size="sm" className="mt-2">Create Order</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map(order => (
                    <Link key={order.id} href={`/staff/orders/${order.id}`}>
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
        </div>
      </div>
    </div>
  )
}
