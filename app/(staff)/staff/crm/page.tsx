import { db } from '@/db'
import { activityEvents, contacts, crmPipelineStages, customerAccounts, deliveries, deliveryStops, invoices, orderItems, orders, salesMembers, salesRegions, tastings, users } from '@/db/schema'
import { sql, eq, and, inArray, asc, max } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getHubSpotCompanies } from '@/lib/hubspot/client'
import { HubSpotCompaniesTab } from '@/components/crm/HubSpotCompaniesTab'
import { LocalAccountsTable } from '@/components/crm/LocalAccountsTable'
import { LocalPeopleTable } from '@/components/crm/LocalPeopleTable'
import { CRMEntityMergeCard } from '@/components/crm/CRMEntityMergeCard'
import { CRMTabs } from '@/components/crm/CRMTabs'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import Link from 'next/link'
import { LayoutList, Kanban } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { mergeContacts, mergeCustomerAccounts } from '@/actions/crm'
import { CRM_ACCOUNT_FILTERS, type CRMAccountFilter, normalizeCRMAccountFilter } from '@/lib/customers/account-segmentation'
import { coercePipelineStages } from '@/lib/deal-stages'
import { formatCurrency } from '@/lib/utils'
import { buildRegionColorMap } from '@/lib/maps/region-colors'

function matchesAccountFilter(account: { customerSegment: string | null; customerSource: string | null }, filter: CRMAccountFilter) {
  if (filter === 'all') return true
  if (filter === 'b2c') return account.customerSegment === 'b2c_consumer'
  if (filter === 'wisher') return account.customerSource === 'wisher_vodka_csv'
  return account.customerSegment !== 'b2c_consumer'
}

function buildCrmHref(basePath: string, view: 'list' | 'pipeline', filter: CRMAccountFilter) {
  const params = new URLSearchParams()
  if (view === 'pipeline') params.set('view', 'pipeline')
  if (filter !== 'b2b') params.set('segment', filter)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function getMostRecentDate(...values: Array<Date | string | null | undefined>) {
  let latest: Date | null = null

  for (const value of values) {
    if (!value) continue
    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) continue
    if (!latest || parsed.getTime() > latest.getTime()) {
      latest = parsed
    }
  }

  return latest
}

export default async function StaffCRMPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; segment?: string }>
}) {
  const session = await requireFeature('crm', 'staff')
  async function submitAccountMerge(formData: FormData) {
    'use server'
    await mergeCustomerAccounts(formData)
  }
  async function submitContactMerge(formData: FormData) {
    'use server'
    await mergeContacts(formData)
  }
  const { view, segment } = await searchParams
  const isPipeline = view === 'pipeline'
  const currentFilter = normalizeCRMAccountFilter(segment)

  const [accounts, people, hsResult, currentSalesMember, pipelineStageRows, allRegions] = await Promise.all([
    db.select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      firstName: customerAccounts.firstName,
      lastName: customerAccounts.lastName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      contactName: customerAccounts.contactName,
      businessType: customerAccounts.businessType,
      customerSegment: customerAccounts.customerSegment,
      customerSource: customerAccounts.customerSource,
      dealStage: customerAccounts.dealStage,
      creditLimit: customerAccounts.creditLimit,
      balance: customerAccounts.balance,
      paymentTerms: customerAccounts.paymentTerms,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
      assignedRegionId: customerAccounts.assignedRegionId,
      salesLeadName: users.name,
      salesRegionName: salesRegions.name,
      hubspotContactId: customerAccounts.hubspotContactId,
      hubspotCompanyId: customerAccounts.hubspotCompanyId,
      starred: customerAccounts.starred,
    })
      .from(customerAccounts)
      .leftJoin(salesMembers, eq(customerAccounts.assignedSalesRepId, salesMembers.id))
      .leftJoin(users, eq(salesMembers.userId, users.id))
      .leftJoin(salesRegions, eq(customerAccounts.assignedRegionId, salesRegions.id))
      .orderBy(customerAccounts.companyName),
    db.select({
      id: contacts.id,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      phone: contacts.phone,
      phoneType: contacts.phoneType,
      preferredContact: contacts.preferredContact,
      isPrimary: contacts.isPrimary,
      companyName: customerAccounts.companyName,
      customerId: customerAccounts.id,
    })
      .from(contacts)
      .innerJoin(customerAccounts, eq(contacts.customerId, customerAccounts.id))
      .orderBy(contacts.name),
    getHubSpotCompanies(),
    db.select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db.select({
      id: crmPipelineStages.id,
      stageKey: crmPipelineStages.stageKey,
      label: crmPipelineStages.label,
      colorToken: crmPipelineStages.colorToken,
      position: crmPipelineStages.position,
    })
      .from(crmPipelineStages)
      .orderBy(asc(crmPipelineStages.position), asc(crmPipelineStages.label)),
    db.select({ id: salesRegions.id, name: salesRegions.name }).from(salesRegions).orderBy(asc(salesRegions.name)),
  ])
  const pipelineStages = coercePipelineStages(pipelineStageRows)
  const regionColors = buildRegionColorMap(allRegions.map((region) => region.name))
  const regionOptions = allRegions.map((region) => ({ value: region.id, label: region.name }))

  // Order stats per customer
  const accountIds = accounts.map(a => a.id)
  const [pendingStats, totalStats, lastOrderStats, accountActivityStats, orderActivityStats, invoiceActivityStats, tastingActivityStats, deliveryActivityStats] = await Promise.all([
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
    accountIds.length === 0 ? [] : db
      .select({
        customerId: orders.customerId,
        lastOrderAt: max(orders.createdAt).as('last_order_at'),
      })
      .from(orders)
      .where(inArray(orders.customerId, accountIds))
      .groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db
      .select({
        customerId: activityEvents.entityId,
        lastActivityAt: max(activityEvents.createdAt).as('last_activity_at'),
      })
      .from(activityEvents)
      .where(and(eq(activityEvents.entityType, 'account'), inArray(activityEvents.entityId, accountIds)))
      .groupBy(activityEvents.entityId),
    accountIds.length === 0 ? [] : db
      .select({
        customerId: orders.customerId,
        lastActivityAt: max(activityEvents.createdAt).as('last_activity_at'),
      })
      .from(activityEvents)
      .innerJoin(orders, eq(activityEvents.entityId, orders.id))
      .where(and(eq(activityEvents.entityType, 'order'), inArray(orders.customerId, accountIds)))
      .groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db
      .select({
        customerId: invoices.customerId,
        lastActivityAt: max(activityEvents.createdAt).as('last_activity_at'),
      })
      .from(activityEvents)
      .innerJoin(invoices, eq(activityEvents.entityId, invoices.id))
      .where(and(eq(activityEvents.entityType, 'invoice'), inArray(invoices.customerId, accountIds)))
      .groupBy(invoices.customerId),
    accountIds.length === 0 ? [] : db
      .select({
        customerId: tastings.customerId,
        lastActivityAt: max(activityEvents.createdAt).as('last_activity_at'),
      })
      .from(activityEvents)
      .innerJoin(tastings, eq(activityEvents.entityId, tastings.id))
      .where(and(eq(activityEvents.entityType, 'tasting'), inArray(tastings.customerId, accountIds)))
      .groupBy(tastings.customerId),
    accountIds.length === 0 ? [] : db
      .select({
        customerId: deliveryStops.customerId,
        lastActivityAt: max(activityEvents.createdAt).as('last_activity_at'),
      })
      .from(activityEvents)
      .innerJoin(deliveries, eq(activityEvents.entityId, deliveries.id))
      .innerJoin(deliveryStops, eq(deliveryStops.deliveryId, deliveries.id))
      .where(and(eq(activityEvents.entityType, 'delivery'), inArray(deliveryStops.customerId, accountIds)))
      .groupBy(deliveryStops.customerId),
  ])

  const pendingMap = new Map(pendingStats.map(r => [r.customerId, Number(r.cases)]))
  const totalMap = new Map(totalStats.map(r => [r.customerId, Number(r.cases)]))
  const lastOrderMap = new Map(lastOrderStats.map(r => [r.customerId, r.lastOrderAt]))
  const accountActivityMap = new Map(accountActivityStats.map(r => [r.customerId, r.lastActivityAt]))
  const orderActivityMap = new Map(orderActivityStats.map(r => [r.customerId, r.lastActivityAt]))
  const invoiceActivityMap = new Map(invoiceActivityStats.map(r => [r.customerId, r.lastActivityAt]))
  const tastingActivityMap = new Map(tastingActivityStats.map(r => [r.customerId, r.lastActivityAt]))
  const deliveryActivityMap = new Map(deliveryActivityStats.map(r => [r.customerId, r.lastActivityAt]))

  const accountRows = accounts.map(a => ({
    ...a,
    regionId: a.assignedRegionId,
    regionName: a.salesRegionName,
    pendingCases: pendingMap.get(a.id) ?? 0,
    totalCasesPurchased: totalMap.get(a.id) ?? 0,
    healthScore: 0,
    lastActivityAt: getMostRecentDate(
      accountActivityMap.get(a.id),
      orderActivityMap.get(a.id),
      invoiceActivityMap.get(a.id),
      tastingActivityMap.get(a.id),
      deliveryActivityMap.get(a.id),
      lastOrderMap.get(a.id),
    ),
  }))
  const filteredAccounts = accounts.filter((account) => matchesAccountFilter(account, currentFilter))
  const filteredAccountRows = accountRows.filter((account) => matchesAccountFilter(account, currentFilter))
  const assignedToMeRows = currentSalesMember
    ? accountRows.filter((account) => account.assignedSalesRepId === currentSalesMember.id)
    : []
  const filteredAssignedToMeRows = assignedToMeRows.filter((account) => matchesAccountFilter(account, currentFilter))
  const filteredAccountIds = new Set(filteredAccounts.map((account) => account.id))
  const filteredPeople = people.filter((person) => filteredAccountIds.has(person.customerId))

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
            {filteredAccounts.length} shown · {accounts.length} local · {hsCompanies.length} in HubSpot
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 border rounded-lg p-1 bg-slate-50">
            <Link href={buildCrmHref('/staff/crm', 'list', currentFilter)}>
              <Button variant={!isPipeline ? 'default' : 'ghost'} size="sm" className="gap-1.5">
                <LayoutList className="w-4 h-4" />
                List
              </Button>
            </Link>
            <Link href={buildCrmHref('/staff/crm', 'pipeline', currentFilter)}>
              <Button variant={isPipeline ? 'default' : 'ghost'} size="sm" className="gap-1.5">
                <Kanban className="w-4 h-4" />
                Pipeline
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-slate-50">
            {CRM_ACCOUNT_FILTERS.map((filter) => (
              <Link key={filter.value} href={buildCrmHref('/staff/crm', isPipeline ? 'pipeline' : 'list', filter.value)}>
                <Button variant={currentFilter === filter.value ? 'default' : 'ghost'} size="sm">
                  {filter.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {isPipeline ? (
        <PipelineBoard accounts={filteredAccountRows} basePath="/staff/crm" stages={pipelineStages} regionColors={regionColors} regionOptions={regionOptions} />
      ) : (
        <Card>
          <CardContent className="grid gap-4 border-b p-4 lg:grid-cols-2">
            <CRMEntityMergeCard
              title="Merge Accounts"
              description="Choose the duplicate account to remove and the account that should survive. All orders, contacts, and data will be moved to the target."
              sourceLabel="Duplicate account (removed)"
              targetLabel="Keep this account"
              options={filteredAccounts.map(a => ({
                id: a.id,
                label: a.companyName,
                preview: {
                  companyName: a.companyName,
                  address: a.address,
                  city: a.city,
                  state: a.state,
                  zip: a.zip,
                  phone: a.phone,
                  email: a.email,
                  contactName: a.contactName,
                  businessType: a.businessType,
                  dealStage: a.dealStage?.replace(/_/g, ' ') ?? null,
                  paymentTerms: a.paymentTerms,
                  creditLimit: formatCurrency(a.creditLimit ?? '0'),
                  balance: formatCurrency(a.balance ?? '0'),
                },
              }))}
              action={submitAccountMerge}
              sourceName="sourceAccountId"
              targetName="targetAccountId"
              previewFields={[
                { key: 'companyName', label: 'Company' },
                { key: 'address', label: 'Address' },
                { key: 'city', label: 'City' },
                { key: 'state', label: 'State' },
                { key: 'zip', label: 'Zip' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'contactName', label: 'Contact' },
                { key: 'businessType', label: 'Biz Type' },
                { key: 'dealStage', label: 'Deal Stage' },
                { key: 'paymentTerms', label: 'Terms' },
                { key: 'creditLimit', label: 'Credit Limit' },
                { key: 'balance', label: 'Balance' },
              ]}
            />
            <CRMEntityMergeCard
              title="Merge People"
              description="Merge a duplicate person into the surviving contact record and preserve the target account link."
              sourceLabel="Duplicate person (removed)"
              targetLabel="Keep this person"
              options={filteredPeople.map(p => ({
                id: p.id,
                label: `${p.name} — ${p.companyName}`,
                preview: {
                  name: p.name,
                  title: p.title,
                  email: p.email,
                  phone: p.phone,
                  phoneType: p.phoneType,
                  preferredContact: p.preferredContact,
                  company: p.companyName,
                },
              }))}
              action={submitContactMerge}
              sourceName="sourceContactId"
              targetName="targetContactId"
              previewFields={[
                { key: 'name', label: 'Name' },
                { key: 'title', label: 'Title' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'phoneType', label: 'Phone Type' },
                { key: 'preferredContact', label: 'Preferred' },
                { key: 'company', label: 'Account' },
              ]}
            />
          </CardContent>
          <CardContent className="p-0">
            <CRMTabs
              tabs={[
                { id: 'local', label: 'Local Accounts', count: filteredAccountRows.length },
                { id: 'assigned', label: 'Assigned To Me', count: filteredAssignedToMeRows.length },
                { id: 'people', label: 'People', count: filteredPeople.length },
                { id: 'hubspot', label: 'HubSpot Companies', count: hsCompanies.length },
              ]}
            >
              <LocalAccountsTable initialAccounts={filteredAccountRows} basePath="/staff/crm" userId={session.user.id} pipelineStages={pipelineStages} regionColors={regionColors} regionOptions={regionOptions} />
              <LocalAccountsTable initialAccounts={filteredAssignedToMeRows} basePath="/staff/crm" userId={session.user.id} pipelineStages={pipelineStages} regionColors={regionColors} regionOptions={regionOptions} />
              <LocalPeopleTable people={filteredPeople} basePath="/staff/crm" />
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
