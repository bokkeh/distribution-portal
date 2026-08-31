import Link from 'next/link'
import { and, asc, countDistinct, eq, inArray, max, ne, sql } from 'drizzle-orm'
import { Kanban, LayoutList, Plus, X } from 'lucide-react'
import { mergeContacts, mergeCustomerAccounts, updateCommunityContactDealStage, updateContactDealStage, updateHubspotCompanyStage } from '@/actions/crm'
import { db } from '@/db'
import {
  activityEvents,
  communityContacts,
  contacts,
  crmPipelineStages,
  customerAccounts,
  deliveries,
  deliveryStops,
  hubspotCompanyPipelineStages,
  invoices,
  orderItems,
  orders,
  salesMembers,
  salesRegions,
  tastings,
  users,
} from '@/db/schema'
import { CRMEntityMergeCard } from '@/components/crm/CRMEntityMergeCard'
import { CRMOverview } from '@/components/crm/CRMOverview'
import { CRMSettingsMenu } from '@/components/crm/CRMSettingsMenu'
import { PageTabs as CRMTabs } from '@/components/ui/PageTabs'
import { CommunityContactsTable } from '@/components/crm/CommunityContactsTable'
import { HubSpotCompaniesTab } from '@/components/crm/HubSpotCompaniesTab'
import { LocalAccountsTable } from '@/components/crm/LocalAccountsTable'
import { LocalPeopleTable } from '@/components/crm/LocalPeopleTable'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import { GenericPipelineBoard, type GenericPipelineItem } from '@/components/crm/GenericPipelineBoard'
import { ListPipelineToggle } from '@/components/crm/ListPipelineToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CRM_ACCOUNT_FILTERS, type CRMAccountFilter, normalizeCRMAccountFilter } from '@/lib/customers/account-segmentation'
import { coercePipelineStages } from '@/lib/deal-stages'
import { requireFeature } from '@/lib/auth/session'
import { getHubSpotCompanies } from '@/lib/hubspot/client'
import { buildRegionColorMap } from '@/lib/maps/region-colors'
import { loadPullThroughDataset, resolvePullThroughScope } from '@/lib/pull-through/data'
import { formatCurrency } from '@/lib/utils'

const CONTACT_CARD_FIELDS = [
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
]
const COMMUNITY_CARD_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
]
const HUBSPOT_CARD_FIELDS = [
  { key: 'location', label: 'Location' },
  { key: 'domain', label: 'Domain' },
  { key: 'phone', label: 'Phone' },
  { key: 'industry', label: 'Industry' },
]

type CRMTool = 'merge-accounts' | 'merge-people'

function matchesAccountFilter(account: { customerSegment: string | null; customerSource: string | null }, filter: CRMAccountFilter) {
  if (filter === 'all') return true
  if (filter === 'b2c') return account.customerSegment === 'b2c_consumer'
  if (filter === 'wisher') return account.customerSource === 'wisher_vodka_csv'
  return account.customerSegment !== 'b2c_consumer'
}

function buildCrmHref(view: 'list' | 'pipeline', filter: CRMAccountFilter) {
  const params = new URLSearchParams({ tab: 'company-accounts' })
  if (view === 'pipeline') params.set('view', 'pipeline')
  if (filter !== 'b2b') params.set('segment', filter)
  return `/admin/crm?${params.toString()}`
}

function buildToolHref(tool: CRMTool, filter: CRMAccountFilter) {
  const params = new URLSearchParams({ tool })
  if (filter !== 'b2b') params.set('segment', filter)
  return `/admin/crm?${params.toString()}`
}

function getMostRecentDate(...values: Array<Date | string | null | undefined>) {
  let latest: Date | null = null
  for (const value of values) {
    if (!value) continue
    const parsed = value instanceof Date ? value : new Date(value)
    if (!Number.isNaN(parsed.getTime()) && (!latest || parsed > latest)) latest = parsed
  }
  return latest
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; segment?: string; tab?: string; tool?: string }>
}) {
  const session = await requireFeature('crm', 'admin')
  const { view, segment, tab, tool: requestedTool } = await searchParams
  const isPipeline = view === 'pipeline'
  const currentFilter = normalizeCRMAccountFilter(segment)
  const tool: CRMTool | null = requestedTool === 'merge-accounts' || requestedTool === 'merge-people' ? requestedTool : null

  async function submitAccountMerge(formData: FormData) {
    'use server'
    await mergeCustomerAccounts(formData)
  }
  async function submitContactMerge(formData: FormData) {
    'use server'
    await mergeContacts(formData)
  }

  const [accounts, people, community, hsResult, currentSalesMember, pipelineStageRows, pullThroughDataset, allRegions, salesLeadOptions, contactStageRows, communityStageRows, hubspotStageRows, hubspotStageAssignments] = await Promise.all([
    db.select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      firstName: customerAccounts.firstName,
      lastName: customerAccounts.lastName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      county: customerAccounts.county,
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
      dealStage: contacts.dealStage,
      companyName: customerAccounts.companyName,
      customerId: customerAccounts.id,
    })
      .from(contacts)
      .innerJoin(customerAccounts, eq(contacts.customerId, customerAccounts.id))
      .orderBy(contacts.name)
      .catch(() => db.select({
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
        .orderBy(contacts.name)
        .then((rows) => rows.map((row) => ({ ...row, dealStage: null as string | null })))),
    db.select({
      id: communityContacts.id,
      firstName: communityContacts.firstName,
      lastName: communityContacts.lastName,
      email: communityContacts.email,
      phone: communityContacts.phone,
      status: communityContacts.status,
      source: communityContacts.source,
      dealStage: communityContacts.dealStage,
      marketingConsentAt: communityContacts.marketingConsentAt,
      createdAt: communityContacts.createdAt,
    })
      .from(communityContacts)
      .orderBy(communityContacts.lastName, communityContacts.firstName)
      .catch(() => db.select({
        id: communityContacts.id,
        firstName: communityContacts.firstName,
        lastName: communityContacts.lastName,
        email: communityContacts.email,
        phone: communityContacts.phone,
        status: communityContacts.status,
        source: communityContacts.source,
        marketingConsentAt: communityContacts.marketingConsentAt,
        createdAt: communityContacts.createdAt,
      })
        .from(communityContacts)
        .orderBy(communityContacts.lastName, communityContacts.firstName)
        .then((rows) => rows.map((row) => ({ ...row, dealStage: null as string | null })))),
    getHubSpotCompanies(),
    db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1).then((rows) => rows[0] ?? null),
    db.select({
      id: crmPipelineStages.id,
      stageKey: crmPipelineStages.stageKey,
      label: crmPipelineStages.label,
      colorToken: crmPipelineStages.colorToken,
      position: crmPipelineStages.position,
    }).from(crmPipelineStages).where(eq(crmPipelineStages.entityType, 'account')).orderBy(asc(crmPipelineStages.position), asc(crmPipelineStages.label)).catch(() => null),
    resolvePullThroughScope(session).then(loadPullThroughDataset),
    db.select({ id: salesRegions.id, name: salesRegions.name }).from(salesRegions).orderBy(asc(salesRegions.name)),
    db
      .select({ id: salesMembers.id, name: users.name })
      .from(salesMembers)
      .innerJoin(users, eq(salesMembers.userId, users.id))
      .where(and(eq(salesMembers.status, 'active'), eq(users.active, true)))
      .orderBy(asc(users.name)),
    db.select({
      id: crmPipelineStages.id,
      stageKey: crmPipelineStages.stageKey,
      label: crmPipelineStages.label,
      colorToken: crmPipelineStages.colorToken,
      position: crmPipelineStages.position,
    }).from(crmPipelineStages).where(eq(crmPipelineStages.entityType, 'contact')).orderBy(asc(crmPipelineStages.position), asc(crmPipelineStages.label)).catch(() => []),
    db.select({
      id: crmPipelineStages.id,
      stageKey: crmPipelineStages.stageKey,
      label: crmPipelineStages.label,
      colorToken: crmPipelineStages.colorToken,
      position: crmPipelineStages.position,
    }).from(crmPipelineStages).where(eq(crmPipelineStages.entityType, 'community_contact')).orderBy(asc(crmPipelineStages.position), asc(crmPipelineStages.label)).catch(() => []),
    db.select({
      id: crmPipelineStages.id,
      stageKey: crmPipelineStages.stageKey,
      label: crmPipelineStages.label,
      colorToken: crmPipelineStages.colorToken,
      position: crmPipelineStages.position,
    }).from(crmPipelineStages).where(eq(crmPipelineStages.entityType, 'hubspot_company')).orderBy(asc(crmPipelineStages.position), asc(crmPipelineStages.label)).catch(() => []),
    db.select({ hubspotCompanyId: hubspotCompanyPipelineStages.hubspotCompanyId, stageKey: hubspotCompanyPipelineStages.stageKey }).from(hubspotCompanyPipelineStages).catch(() => []),
  ])

  const regionColors = buildRegionColorMap(allRegions.map((region) => region.name))
  const regionOptions = allRegions.map((region) => ({ value: region.id, label: region.name }))
  const salesLeadInlineOptions = salesLeadOptions.map((member) => ({ value: member.id, label: member.name }))
  const pipelineStages = coercePipelineStages(pipelineStageRows)
  const contactPipelineStages = coercePipelineStages(contactStageRows)
  const communityPipelineStages = coercePipelineStages(communityStageRows)
  const hubspotPipelineStages = coercePipelineStages(hubspotStageRows)
  const hubspotStageMap = new Map(hubspotStageAssignments.map((row) => [row.hubspotCompanyId, row.stageKey]))
  const accountIds = accounts.map((account) => account.id)
  const [pendingStats, totalStats, orderStats, accountActivityStats, orderActivityStats, invoiceActivityStats, tastingActivityStats, deliveryActivityStats] = await Promise.all([
    accountIds.length === 0 ? [] : db.select({ customerId: orders.customerId, cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)`.as('cases') }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(inArray(orders.customerId, accountIds), inArray(orders.status, ['pending', 'confirmed']))).groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db.select({ customerId: orders.customerId, cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)`.as('cases') }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(inArray(orders.customerId, accountIds), inArray(orders.status, ['confirmed', 'fulfilled']))).groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db.select({ customerId: orders.customerId, orderCount: countDistinct(orders.id), lastOrderAt: max(orders.createdAt).as('last_order_at') }).from(orders).where(and(inArray(orders.customerId, accountIds), ne(orders.status, 'cancelled'))).groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db.select({ customerId: activityEvents.entityId, lastActivityAt: max(activityEvents.createdAt).as('last_activity_at') }).from(activityEvents).where(and(eq(activityEvents.entityType, 'account'), inArray(activityEvents.entityId, accountIds))).groupBy(activityEvents.entityId),
    accountIds.length === 0 ? [] : db.select({ customerId: orders.customerId, lastActivityAt: max(activityEvents.createdAt).as('last_activity_at') }).from(activityEvents).innerJoin(orders, eq(activityEvents.entityId, orders.id)).where(and(eq(activityEvents.entityType, 'order'), inArray(orders.customerId, accountIds))).groupBy(orders.customerId),
    accountIds.length === 0 ? [] : db.select({ customerId: invoices.customerId, lastActivityAt: max(activityEvents.createdAt).as('last_activity_at') }).from(activityEvents).innerJoin(invoices, eq(activityEvents.entityId, invoices.id)).where(and(eq(activityEvents.entityType, 'invoice'), inArray(invoices.customerId, accountIds))).groupBy(invoices.customerId),
    accountIds.length === 0 ? [] : db.select({ customerId: tastings.customerId, lastActivityAt: max(activityEvents.createdAt).as('last_activity_at') }).from(activityEvents).innerJoin(tastings, eq(activityEvents.entityId, tastings.id)).where(and(eq(activityEvents.entityType, 'tasting'), inArray(tastings.customerId, accountIds))).groupBy(tastings.customerId),
    accountIds.length === 0 ? [] : db.select({ customerId: deliveryStops.customerId, lastActivityAt: max(activityEvents.createdAt).as('last_activity_at') }).from(activityEvents).innerJoin(deliveries, eq(activityEvents.entityId, deliveries.id)).innerJoin(deliveryStops, eq(deliveryStops.deliveryId, deliveries.id)).where(and(eq(activityEvents.entityType, 'delivery'), inArray(deliveryStops.customerId, accountIds))).groupBy(deliveryStops.customerId),
  ])

  const pendingMap = new Map(pendingStats.map((row) => [row.customerId, Number(row.cases)]))
  const totalMap = new Map(totalStats.map((row) => [row.customerId, Number(row.cases)]))
  const orderMap = new Map(orderStats.map((row) => [row.customerId, row]))
  const pullThroughMap = new Map(pullThroughDataset.rows.map((row) => [row.accountId, row]))
  const accountActivityMap = new Map(accountActivityStats.map((row) => [row.customerId, row.lastActivityAt]))
  const orderActivityMap = new Map(orderActivityStats.map((row) => [row.customerId, row.lastActivityAt]))
  const invoiceActivityMap = new Map(invoiceActivityStats.map((row) => [row.customerId, row.lastActivityAt]))
  const tastingActivityMap = new Map(tastingActivityStats.map((row) => [row.customerId, row.lastActivityAt]))
  const deliveryActivityMap = new Map(deliveryActivityStats.map((row) => [row.customerId, row.lastActivityAt]))
  const now = Date.now()

  function computeHealthScore(account: typeof accounts[number]) {
    const lastOrder = orderMap.get(account.id)?.lastOrderAt
    const daysSince = lastOrder ? (now - new Date(lastOrder).getTime()) / 86_400_000 : null
    const recency = daysSince == null ? 0 : daysSince <= 30 ? 40 : daysSince <= 60 ? 30 : daysSince <= 90 ? 20 : daysSince <= 180 ? 10 : 0
    const credit = Number(account.creditLimit ?? 0)
    const balance = Number(account.balance ?? 0)
    const payment = balance <= 0 ? 40 : credit > 0 && balance < credit * 0.25 ? 30 : credit > 0 && balance < credit * 0.5 ? 20 : credit > 0 && balance < credit ? 10 : 0
    const cases = totalMap.get(account.id) ?? 0
    const volume = cases > 100 ? 20 : cases > 50 ? 15 : cases > 20 ? 10 : cases > 5 ? 5 : 0
    return recency + payment + volume
  }

  const accountRows = accounts.map((account) => {
    const pullThrough = pullThroughMap.get(account.id)
    const generalOrders = orderMap.get(account.id)
    const lastOrderAt = pullThrough?.orders.lastOrderAt ?? generalOrders?.lastOrderAt ?? null
    const fallbackDaysSince = lastOrderAt ? Math.max(0, Math.floor((now - new Date(lastOrderAt).getTime()) / 86_400_000)) : null
    const locationFallback = [account.city, account.state].filter(Boolean).join(', ') || null

    return {
      ...account,
      pendingCases: pendingMap.get(account.id) ?? 0,
      totalCasesPurchased: pullThrough?.orders.totalCases ?? totalMap.get(account.id) ?? 0,
      healthScore: computeHealthScore(account),
      regionId: account.assignedRegionId,
      regionName: account.salesRegionName ?? pullThrough?.territory ?? account.county ?? locationFallback,
      orderCount: pullThrough?.orders.totalOrders ?? Number(generalOrders?.orderCount ?? 0),
      daysSinceLastOrder: pullThrough?.orders.daysSinceLastOrder ?? fallbackDaysSince,
      pullThroughScore: pullThrough?.pullThrough.score ?? null,
      lastActivityAt: getMostRecentDate(pullThrough?.lastActivityAt, accountActivityMap.get(account.id), orderActivityMap.get(account.id), invoiceActivityMap.get(account.id), tastingActivityMap.get(account.id), deliveryActivityMap.get(account.id), lastOrderAt),
    }
  })

  const filteredAccounts = accounts.filter((account) => matchesAccountFilter(account, currentFilter))
  const filteredAccountRows = accountRows.filter((account) => matchesAccountFilter(account, currentFilter))
  const assignedToMeRows = currentSalesMember ? accountRows.filter((account) => account.assignedSalesRepId === currentSalesMember.id) : []
  const filteredAssignedToMeRows = assignedToMeRows.filter((account) => matchesAccountFilter(account, currentFilter))
  const filteredAccountIds = new Set(filteredAccounts.map((account) => account.id))
  const filteredPeople = people.filter((person) => filteredAccountIds.has(person.customerId))
  const localAccountIds = new Map(accounts.filter((account) => account.hubspotCompanyId).map((account) => [account.hubspotCompanyId!, account.id]))
  const importedHsIds = new Set(localAccountIds.keys())
  const { companies: hsCompanies, error: hsError } = hsResult
  const pullThroughScores = pullThroughDataset.rows.map((row) => row.pullThrough.score).filter((score): score is number => score != null)
  const averagePullThrough = pullThroughScores.length ? Math.round(pullThroughScores.reduce((sum, score) => sum + score, 0) / pullThroughScores.length) : null

  const contactPipelineItems: GenericPipelineItem[] = filteredPeople.map((person) => ({
    id: person.id,
    dealStage: person.dealStage,
    title: person.name,
    subtitle: person.companyName,
    href: `/admin/crm/${person.customerId}`,
    fields: {
      company: person.companyName,
      title: person.title,
      email: person.email,
      phone: person.phone,
    },
  }))

  const communityPipelineItems: GenericPipelineItem[] = community.map((contact) => ({
    id: contact.id,
    dealStage: contact.dealStage,
    title: `${contact.firstName} ${contact.lastName}`.trim(),
    subtitle: contact.email,
    href: `/admin/crm/community/${contact.id}`,
    fields: {
      email: contact.email,
      phone: contact.phone,
      status: contact.status.replaceAll('_', ' '),
      source: contact.source.replaceAll('_', ' '),
    },
  }))

  const hubspotPipelineItems: GenericPipelineItem[] = hsCompanies.map((company) => ({
    id: company.id,
    dealStage: hubspotStageMap.get(company.id) ?? null,
    title: company.name || 'Unnamed company',
    subtitle: [company.city, company.state].filter(Boolean).join(', ') || null,
    href: null,
    fields: {
      location: [company.city, company.state].filter(Boolean).join(', '),
      domain: company.domain,
      phone: company.phone,
      industry: company.industry,
    },
  }))
  const defaultTab = ['overview', 'company-accounts', 'company-contacts', 'community-contacts', 'assigned', 'hubspot'].includes(tab ?? '') ? tab : 'company-accounts'

  const mergeAccountCard = (
    <CRMEntityMergeCard
      title="Merge Accounts"
      description="Choose the duplicate account to remove and the account that should survive. All orders, contacts, and data will be moved to the target."
      sourceLabel="Duplicate account (removed)"
      targetLabel="Keep this account"
      options={filteredAccounts.map((account) => ({ id: account.id, label: account.companyName, preview: { companyName: account.companyName, address: account.address, city: account.city, state: account.state, zip: account.zip, phone: account.phone, email: account.email, contactName: account.contactName, businessType: account.businessType, dealStage: account.dealStage?.replace(/_/g, ' ') ?? null, paymentTerms: account.paymentTerms, creditLimit: formatCurrency(account.creditLimit ?? '0'), balance: formatCurrency(account.balance ?? '0') } }))}
      action={submitAccountMerge}
      sourceName="sourceAccountId"
      targetName="targetAccountId"
      previewFields={[{ key: 'companyName', label: 'Company' }, { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'zip', label: 'Zip' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'contactName', label: 'Contact' }, { key: 'businessType', label: 'Biz Type' }, { key: 'dealStage', label: 'Deal Stage' }, { key: 'paymentTerms', label: 'Terms' }, { key: 'creditLimit', label: 'Credit Limit' }, { key: 'balance', label: 'Balance' }]}
      defaultExpanded
    />
  )

  const mergePeopleCard = (
    <CRMEntityMergeCard
      title="Merge People"
      description="Merge a duplicate company contact into the surviving contact record and preserve the target account link."
      sourceLabel="Duplicate person (removed)"
      targetLabel="Keep this person"
      options={filteredPeople.map((person) => ({ id: person.id, label: `${person.name} — ${person.companyName}`, preview: { name: person.name, title: person.title, email: person.email, phone: person.phone, phoneType: person.phoneType, preferredContact: person.preferredContact, company: person.companyName } }))}
      action={submitContactMerge}
      sourceName="sourceContactId"
      targetName="targetContactId"
      previewFields={[{ key: 'name', label: 'Name' }, { key: 'title', label: 'Title' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'phoneType', label: 'Phone Type' }, { key: 'preferredContact', label: 'Preferred' }, { key: 'company', label: 'Account' }]}
      defaultExpanded
    />
  )

  return (
    <div className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
      <Card className="rounded-2xl border-slate-200 bg-white shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-7">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase leading-none text-[#181615] sm:text-5xl">CRM / Accounts</h1>
            <p className="mt-2 text-sm text-slate-500">{accounts.length} company accounts · {people.length} company contacts · {community.length} community contacts</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="font-display uppercase"><Link href="/admin/crm/people/new"><Plus className="h-4 w-4" />Add people</Link></Button>
            <Button asChild className="bg-[#ff5a00] font-display uppercase hover:bg-[#e65000]"><Link href="/admin/crm/new"><Plus className="h-4 w-4" />Create account</Link></Button>
            <CRMSettingsMenu mergeAccountsHref={buildToolHref('merge-accounts', currentFilter)} mergePeopleHref={buildToolHref('merge-people', currentFilter)} />
          </div>
        </CardContent>
      </Card>

      {tool ? (
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold text-slate-900">CRM management</p><Button asChild variant="ghost" size="icon"><Link href={buildCrmHref('list', currentFilter)} aria-label="Close CRM management"><X className="h-4 w-4" /></Link></Button></div>
            {tool === 'merge-accounts' ? mergeAccountCard : mergePeopleCard}
          </CardContent>
        </Card>
      ) : null}

      <CRMTabs
        ariaLabel="CRM views"
        defaultTab={defaultTab}
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'company-accounts', label: 'Company Accounts' }, { id: 'company-contacts', label: 'Company Contacts' }, { id: 'community-contacts', label: 'Community Contacts' }, { id: 'assigned', label: 'Assigned To Me' }, { id: 'hubspot', label: 'HubSpot Companies' }]}
      >
        <Card className="mt-6 shadow-none"><CRMOverview accountCount={accounts.length} companyContactCount={people.length} communityContactCount={community.length} assignedCount={assignedToMeRows.length} averagePullThrough={averagePullThrough} /></Card>
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <Button asChild variant={!isPipeline ? 'default' : 'ghost'} size="sm"><Link href={buildCrmHref('list', currentFilter)}><LayoutList className="h-4 w-4" />List</Link></Button>
              <Button asChild variant={isPipeline ? 'default' : 'ghost'} size="sm"><Link href={buildCrmHref('pipeline', currentFilter)}><Kanban className="h-4 w-4" />Pipeline</Link></Button>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              {CRM_ACCOUNT_FILTERS.map((filter) => <Button key={filter.value} asChild variant={currentFilter === filter.value ? 'default' : 'ghost'} size="sm"><Link href={buildCrmHref(isPipeline ? 'pipeline' : 'list', filter.value)}>{filter.label}</Link></Button>)}
            </div>
          </div>
          {isPipeline ? <PipelineBoard accounts={filteredAccountRows} basePath="/admin/crm" stages={pipelineStages} canManageStages canCreateAccounts regionColors={regionColors} regionOptions={regionOptions} /> : <Card className="overflow-hidden shadow-none"><LocalAccountsTable initialAccounts={filteredAccountRows} userId={session.user.id} pipelineStages={pipelineStages} regionColors={regionColors} regionOptions={regionOptions} salesLeadOptions={salesLeadInlineOptions} canAssignSalesLead /></Card>}
        </div>
        <div className="mt-6">
          <ListPipelineToggle
            list={<Card className="overflow-hidden shadow-none"><LocalPeopleTable people={filteredPeople} basePath="/admin/crm" /></Card>}
            pipeline={
              <GenericPipelineBoard
                entityType="contact"
                items={contactPipelineItems}
                stages={contactPipelineStages}
                canManageStages
                fieldOptions={CONTACT_CARD_FIELDS}
                defaultFields={['company']}
                storageKey="crm-pipeline-contact-card-fields:v1"
                updateItemStage={updateContactDealStage}
              />
            }
          />
        </div>
        <div className="mt-6">
          <ListPipelineToggle
            list={<Card className="overflow-hidden shadow-none"><CommunityContactsTable contacts={community} /></Card>}
            pipeline={
              <GenericPipelineBoard
                entityType="community_contact"
                items={communityPipelineItems}
                stages={communityPipelineStages}
                canManageStages
                fieldOptions={COMMUNITY_CARD_FIELDS}
                defaultFields={['status']}
                storageKey="crm-pipeline-community-card-fields:v1"
                updateItemStage={updateCommunityContactDealStage}
              />
            }
          />
        </div>
        <div className="mt-6">
          <ListPipelineToggle
            list={<Card className="overflow-hidden shadow-none"><LocalAccountsTable initialAccounts={filteredAssignedToMeRows} userId={session.user.id} pipelineStages={pipelineStages} regionColors={regionColors} regionOptions={regionOptions} salesLeadOptions={salesLeadInlineOptions} canAssignSalesLead /></Card>}
            pipeline={
              <PipelineBoard
                accounts={filteredAssignedToMeRows}
                basePath="/admin/crm"
                stages={pipelineStages}
                regionColors={regionColors}
                regionOptions={regionOptions}
              />
            }
          />
        </div>
        <div className="mt-6">
          <ListPipelineToggle
            list={<Card className="overflow-hidden shadow-none"><HubSpotCompaniesTab companies={hsCompanies} importedIds={importedHsIds} localAccountIds={localAccountIds} error={hsError} /></Card>}
            pipeline={
              <GenericPipelineBoard
                entityType="hubspot_company"
                items={hubspotPipelineItems}
                stages={hubspotPipelineStages}
                canManageStages
                fieldOptions={HUBSPOT_CARD_FIELDS}
                defaultFields={['location']}
                storageKey="crm-pipeline-hubspot-card-fields:v1"
                updateItemStage={updateHubspotCompanyStage}
              />
            }
          />
        </div>
      </CRMTabs>
    </div>
  )
}
