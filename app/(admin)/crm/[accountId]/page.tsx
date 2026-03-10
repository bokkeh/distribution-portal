import { db } from '@/db'
import { customerAccounts, contacts, orders, invoices } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { syncToHubSpot } from '@/actions/crm'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Phone, Mail, MapPin } from 'lucide-react'

export default async function AccountDetailPage({ params }: { params: { accountId: string } }) {
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, params.accountId))
  if (!account) notFound()

  const [accountContacts, accountOrders, accountInvoices] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.customerId, params.accountId)),
    db.select().from(orders).where(eq(orders.customerId, params.accountId)).orderBy(desc(orders.createdAt)).limit(10),
    db.select().from(invoices).where(eq(invoices.customerId, params.accountId)).orderBy(desc(invoices.createdAt)).limit(10),
  ])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/crm"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{account.companyName}</h1>
          <p className="text-muted-foreground mt-1">Customer Account</p>
        </div>
        <form action={syncToHubSpot.bind(null, account.id)}>
          <Button variant="outline" type="submit"><RefreshCw className="w-4 h-4 mr-2" />Sync HubSpot</Button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info */}
        <Card>
          <CardHeader><CardTitle>Account Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {account.address && (
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p>{account.address}</p>
                  <p>{[account.city, account.state, account.zip].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}
            {account.phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{account.phone}</span></div>}
            {account.email && <div className="flex gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span>{account.email}</span></div>}
            <div className="pt-3 border-t space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Payment Terms</span><Badge variant="secondary">{account.paymentTerms}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit Limit</span><span className="font-medium">{formatCurrency(account.creditLimit ?? '0')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className="font-medium">{formatCurrency(account.balance ?? '0')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">HubSpot</span>{account.hubspotContactId ? <Badge variant="success">Synced</Badge> : <Badge variant="outline">Not synced</Badge>}</div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contacts</CardTitle>
            <Link href={`/admin/crm/${account.id}/contacts`}><Button variant="ghost" size="sm">Manage</Button></Link>
          </CardHeader>
          <CardContent>
            {accountContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added.</p>
            ) : accountContacts.map(contact => (
              <div key={contact.id} className="py-2 border-b last:border-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{contact.name}</p>
                  {contact.isPrimary && <Badge variant="info" className="text-xs">Primary</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{contact.title}</p>
                <p className="text-xs text-muted-foreground">{contact.email}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
          <CardContent>
            {accountOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders.</p>
            ) : accountOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
                  <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
