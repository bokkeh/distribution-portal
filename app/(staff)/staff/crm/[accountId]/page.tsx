import { db } from '@/db'
import { customerAccounts, contacts, orders } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { DealStageSelect } from '@/components/crm/DealStageSelect'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Phone, Mail, MapPin, TrendingUp } from 'lucide-react'

export default async function StaffAccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId))
  if (!account) notFound()

  const [accountContacts, recentOrders] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.customerId, accountId)),
    db.select({ id: orders.id, total: orders.total, status: orders.status, createdAt: orders.createdAt })
      .from(orders).where(eq(orders.customerId, accountId)).orderBy(desc(orders.createdAt)).limit(5),
  ])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/staff/crm"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{account.companyName}</h1>
          <p className="text-muted-foreground mt-1">Customer Account</p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <DealStageSelect accountId={account.id} currentStage={account.dealStage} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Account Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {account.address && (
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p>{account.address}</p>
                  <p>{[account.city, account.state, account.zip].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}
            {account.phone && (
              <div className="flex gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <PhoneSmsButton phone={account.phone} recipientName={account.companyName} showIcon={false} className="text-sm" />
              </div>
            )}
            {account.email && (
              <div className="flex gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{account.email}</span>
              </div>
            )}
            {account.contactName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Person of Contact</span>
                <span>{account.contactName}</span>
              </div>
            )}
            {account.state === 'DC' && account.dcAbraNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">DC ABRA Number</span>
                <span>{account.dcAbraNumber}</span>
              </div>
            )}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Terms</span><Badge variant="secondary">{account.paymentTerms}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit Limit</span><span>{formatCurrency(account.creditLimit ?? '0')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>{formatCurrency(account.balance ?? '0')}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
          <CardContent>
            {accountContacts.length === 0
              ? <p className="text-sm text-muted-foreground">No contacts.</p>
              : accountContacts.map(c => (
                <div key={c.id} className="py-2 border-b last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.isPrimary && <Badge variant="info" className="text-xs">Primary</Badge>}
                  </div>
                  {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  {c.phone ? <PhoneSmsButton phone={c.phone} recipientName={c.name} className="text-xs" /> : null}
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
          <CardContent>
            {recentOrders.length === 0
              ? <p className="text-sm text-muted-foreground">No orders.</p>
              : recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">#{o.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(o.total)}</p>
                    <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
