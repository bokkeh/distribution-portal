import { db } from '@/db'
import { customerAccounts, orders, orderItems } from '@/db/schema'
import { sql, eq, and, inArray } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getHubSpotCompanies } from '@/lib/hubspot/client'
import { HubSpotCompaniesTab } from '@/components/crm/HubSpotCompaniesTab'
import { LocalAccountsTable } from '@/components/crm/LocalAccountsTable'
import { CRMTabs } from '@/components/crm/CRMTabs'
import { DealStageSelect } from '@/components/crm/DealStageSelect'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import Link from 'next/link'
import { LayoutList, Kanban } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'

export default async function StaffCRMPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const session = await requireFeature('crm', 'staff')
  const { view } = await searchParams
  const isPipeline = view === 'pipeline'

  const [accounts, hsResult] = await Promise.all([
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
      dealStage: customerAccounts.dealStage,
      contactName: customerAccounts.contactName,
    }).from(customerAccounts).orderBy(customerAccounts.companyName),
    getHubSpotCompanies(),
  ])

  // Order stats per customer
  const accountIds = accounts.map(a => a.id)
  const [pendingStats, totalStats] = await Promise.all([
    accountIds.length === 0 ? [] : db
      .select({
        customerId: orders.customerId,
        cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)`.as('cases'),
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(inArray(orders.customerId, accountIds), inArray(orders.status, ['pending', 'confirmed'])))
      .groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db
      .select({
        customerId: orders.customerId,
        cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)`.as('cases'),
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(inArray(orders.customerId, accountIds), inArray(orders.status, ['confirmed', 'fulfilled'])))
      .groupBy(orders.customerId),
  ])

  const pendingMap = new Map(pendingStats.map(r => [r.customerId, Number(r.cases)]))
  const totalMap = new Map(totalStats.map(r => [r.customerId, Number(r.cases)]))

  const accountRows = accounts.map(a => ({
    ...a,
    pendingCases: pendingMap.get(a.id) ?? 0,
    totalCasesPurchased: totalMap.get(a.id) ?? 0,
  }))

  const localAccountIds = new Map<string, string>(
    accounts.filter(a => a.hubspotCompanyId).map(a => [a.hubspotCompanyId!, a.id])
  )
  const importedHsIds = new Set(localAccountIds.keys())
  const { companies: hsCompanies, error: hsError } = hsResult

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Accounts</h1>
          <p className="text-muted-foreground mt-1">
            {accounts.length} local · {hsCompanies.length} in HubSpot
          </p>
        </div>
        <div className="flex items-center gap-2 border rounded-lg p-1 bg-slate-50">
          <Link href="/staff/crm">
            <Button variant={!isPipeline ? 'default' : 'ghost'} size="sm" className="gap-1.5">
              <LayoutList className="w-4 h-4" />
              List
            </Button>
          </Link>
          <Link href="/staff/crm?view=pipeline">
            <Button variant={isPipeline ? 'default' : 'ghost'} size="sm" className="gap-1.5">
              <Kanban className="w-4 h-4" />
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {isPipeline ? (
        <PipelineBoard accounts={accounts} basePath="/staff/crm" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <CRMTabs
              tabs={[
              { id: 'local', label: 'Local Accounts', count: accounts.length },
              { id: 'hubspot', label: 'HubSpot Companies', count: hsCompanies.length },
            ]}
          >
              <LocalAccountsTable initialAccounts={accountRows} basePath="/staff/crm" userId={session.user.id} />
              <HubSpotCompaniesTab
                companies={hsCompanies}
                importedIds={importedHsIds}
                localAccountIds={localAccountIds}
                error={hsError}
              />
            </CRMTabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
