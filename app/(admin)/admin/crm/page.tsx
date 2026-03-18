import { db } from '@/db'
import { customerAccounts, orders, orderItems, contacts } from '@/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getHubSpotCompanies } from '@/lib/hubspot/client'
import { HubSpotCompaniesTab } from '@/components/crm/HubSpotCompaniesTab'
import { LocalAccountsTable } from '@/components/crm/LocalAccountsTable'
import { LocalPeopleTable } from '@/components/crm/LocalPeopleTable'
import { CRMTabs } from '@/components/crm/CRMTabs'
import { sql, eq, and, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'

export default async function CRMPage() {
  const session = await requireFeature('crm', 'admin')
  const [accounts, people, hsResult] = await Promise.all([
    db.select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      city: customerAccounts.city,
      state: customerAccounts.state,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      creditLimit: customerAccounts.creditLimit,
      balance: customerAccounts.balance,
      paymentTerms: customerAccounts.paymentTerms,
      hubspotContactId: customerAccounts.hubspotContactId,
      hubspotCompanyId: customerAccounts.hubspotCompanyId,
      starred: customerAccounts.starred,
    }).from(customerAccounts).orderBy(customerAccounts.companyName),
    db.select({
      id: contacts.id,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      phone: contacts.phone,
      preferredContact: contacts.preferredContact,
      isPrimary: contacts.isPrimary,
      companyName: customerAccounts.companyName,
      customerId: customerAccounts.id,
    })
      .from(contacts)
      .innerJoin(customerAccounts, eq(contacts.customerId, customerAccounts.id))
      .orderBy(contacts.name),
    getHubSpotCompanies(),
  ])

  // Aggregate order stats per customer
  const accountIds = accounts.map(a => a.id)
  const [pendingStats, totalStats] = await Promise.all([
    // Cases in pending/confirmed orders (in the pipeline, not yet fulfilled)
    accountIds.length === 0 ? [] : db
      .select({
        customerId: orders.customerId,
        cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)`.as('cases'),
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(
        inArray(orders.customerId, accountIds),
        inArray(orders.status, ['pending', 'confirmed'])
      ))
      .groupBy(orders.customerId),

    // Total cases ever purchased (all non-cancelled orders)
    accountIds.length === 0 ? [] : db
      .select({
        customerId: orders.customerId,
        cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)`.as('cases'),
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(
        inArray(orders.customerId, accountIds),
        inArray(orders.status, ['confirmed', 'fulfilled'])
      ))
      .groupBy(orders.customerId),
  ])

  const pendingMap = new Map(pendingStats.map(r => [r.customerId, Number(r.cases)]))
  const totalMap = new Map(totalStats.map(r => [r.customerId, Number(r.cases)]))

  const accountRows = accounts.map(a => ({
    ...a,
    pendingCases: pendingMap.get(a.id) ?? 0,
    totalCasesPurchased: totalMap.get(a.id) ?? 0,
  }))

  // Map hubspotCompanyId → local account id
  const localAccountIds = new Map<string, string>(
    accounts.filter(a => a.hubspotCompanyId).map(a => [a.hubspotCompanyId!, a.id])
  )
  const importedHsIds = new Set(localAccountIds.keys())
  const { companies: hsCompanies, error: hsError } = hsResult

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM / Accounts</h1>
          <p className="text-muted-foreground mt-1">
            {accounts.length} local · {hsCompanies.length} in HubSpot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/crm/sales-routes">
            <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Sales Routes</Button>
          </Link>
          <Link href="/admin/users/new">
            <Button><Plus className="w-4 h-4 mr-2" />Add Account</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <CRMTabs
            tabs={[
              { id: 'local', label: 'Local Accounts', count: accounts.length },
              { id: 'people', label: 'People', count: people.length },
              { id: 'hubspot', label: 'HubSpot Companies', count: hsCompanies.length },
            ]}
          >
            <LocalAccountsTable initialAccounts={accountRows} userId={session.user.id} />
            <LocalPeopleTable people={people} basePath="/admin/crm" />
            <HubSpotCompaniesTab
              companies={hsCompanies}
              importedIds={importedHsIds}
              localAccountIds={localAccountIds}
              error={hsError}
            />
          </CRMTabs>
        </CardContent>
      </Card>
    </div>
  )
}
