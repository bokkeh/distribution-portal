import Link from 'next/link'
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { contacts, deliveries, deliveryStops, invoices, orders, salesMembers, salesRegions, smsMessages, tastingReports, tastings, users } from '@/db/schema'
import { syncToHubSpot } from '@/actions/crm'
import { getCRMAccountDetail } from '@/lib/crm/account-read'
import {
  getAccountActivityFeed,
  getAccountInventoryHistory,
  getAccountInventoryOnHand,
  getAccountMediaFeed,
  getAccountNotes,
  getAvailableInventoryProducts,
} from '@/lib/crm/account-detail-data'
import { normalizePhone } from '@/lib/telnyx/compliance'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { AccountActivityCard } from '@/components/crm/AccountActivityCard'
import { AccountDetailsCard } from '@/components/crm/AccountDetailsCard'
import { AccountEditForm } from '@/components/crm/AccountEditForm'
import { AccountInventoryOnHandCard } from '@/components/crm/AccountInventoryOnHandCard'
import { AccountInventorySummaryCard } from '@/components/crm/AccountInventorySummaryCard'
import { AccountMapCard } from '@/components/crm/AccountMapCard'
import { AccountMediaGalleryCard } from '@/components/crm/AccountMediaGalleryCard'
import { AccountMediaInsightsCard } from '@/components/crm/AccountMediaInsightsCard'
import { AccountMediaUploadCard } from '@/components/crm/AccountMediaUploadCard'
import { AccountNotesCard } from '@/components/crm/AccountNotesCard'
import { AccountRecordTabs } from '@/components/crm/AccountRecordTabs'
import { AccountSmartInsightsCard } from '@/components/crm/AccountSmartInsightsCard'
import { ViewAsAccountButton } from '@/components/admin/ViewAsAccountButton'
import { generateAccountSmartInsights } from '@/lib/crm/smart-insights'
import { ArrowLeft, CalendarDays, FileText, MessageSquare, Plus, Receipt, RefreshCcw, RefreshCw, Truck } from 'lucide-react'

const ACCOUNT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'notes-activity', label: 'Notes & Activity' },
  { id: 'media', label: 'Media' },
  { id: 'settings', label: 'Settings' },
] as const

type TabId = (typeof ACCOUNT_TABS)[number]['id']
type AccountRecordMode = 'admin' | 'staff' | 'sales'

function normalizeTab(value: string | undefined): TabId {
  return ACCOUNT_TABS.some((tab) => tab.id === value) ? (value as TabId) : 'overview'
}

function getTabHref(basePath: string, tab: TabId) {
  return tab === 'overview' ? basePath : `${basePath}?tab=${tab}`
}

function getAccountBasePath(mode: AccountRecordMode, accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}` : `/${mode}/crm/${accountId}`
}

function getAccountIndexPath(mode: AccountRecordMode) {
  return mode === 'sales' ? '/sales/accounts' : `/${mode}/crm`
}

function getContactsPath(mode: AccountRecordMode, accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}/contacts` : `/${mode}/crm/${accountId}/contacts`
}

function getCreateOrderPath(mode: AccountRecordMode, accountId: string) {
  return mode === 'sales' ? null : `/${mode}/orders/new?customer=${accountId}`
}

function getOrderDetailPath(mode: AccountRecordMode, orderId: string) {
  return mode === 'sales' ? null : `/${mode}/orders/${orderId}`
}

function getDeliveryReportPath(mode: AccountRecordMode, deliveryId: string) {
  return mode === 'admin' ? `/admin/deliveries/${deliveryId}` : null
}

function getTastingReportPath(mode: AccountRecordMode, tastingId: string) {
  if (mode === 'admin') return `/admin/tastings/${tastingId}`
  if (mode === 'staff') return '/staff/tastings/reports'
  return '/sales/tastings'
}

function getTastingReportLinkLabel(mode: AccountRecordMode, hasReport: boolean) {
  if (mode === 'admin') return hasReport ? 'View report' : 'Open tasting'
  if (mode === 'staff') return 'Open reports'
  return 'Open tastings'
}

function getInvoicingIndexPath(mode: AccountRecordMode) {
  if (mode === 'admin') return '/admin/invoicing'
  if (mode === 'staff') return '/staff/invoicing'
  return null
}

function getAccountPhonesForInboxMatch(...values: Array<string | null | undefined>) {
  const phones = new Set<string>()

  for (const value of values) {
    const phone = value?.trim()
    if (!phone) continue

    phones.add(phone)

    try {
      phones.add(normalizePhone(phone))
    } catch {
      // Keep the raw value for legacy rows even if the phone is not parseable.
    }
  }

  return Array.from(phones)
}

type Props = {
  accountId: string
  mode: AccountRecordMode
  currentUserId?: string
  currentUserRoles: string[]
  selectedTab?: string
  showSyncAction?: boolean
  showViewAs?: boolean
}

export async function AccountRecordPage({
  accountId,
  mode,
  currentUserId,
  currentUserRoles,
  selectedTab,
  showSyncAction = false,
  showViewAs = false,
}: Props) {
  const tab = normalizeTab(selectedTab)
  const basePath = getAccountBasePath(mode, accountId)

  const account = await getCRMAccountDetail(accountId)
  if (!account) notFound()

  const [assignedRegion] = account.assignedRegionId
    ? await db
        .select({ id: salesRegions.id, name: salesRegions.name })
        .from(salesRegions)
        .where(eq(salesRegions.id, account.assignedRegionId))
        .limit(1)
    : []

  const salesLeadOptions = mode === 'admin'
    ? await db
        .select({
          id: salesMembers.id,
          name: users.name,
        })
        .from(salesMembers)
        .innerJoin(users, eq(salesMembers.userId, users.id))
        .where(and(eq(salesMembers.status, 'active'), eq(users.active, true)))
        .orderBy(asc(users.name))
    : []

  const accountPhones = getAccountPhonesForInboxMatch(account.phone, account.businessPhone, account.pocPhone)
  const createOrderHref = getCreateOrderPath(mode, account.id)
  const invoicingIndexHref = getInvoicingIndexPath(mode)
  const canUploadAccountMedia = currentUserRoles.some((role) => ['admin', 'sales_rep', 'sales_manager'].includes(role))
  const canUseMediaInsights = currentUserRoles.some((role) => ['admin', 'staff', 'sales_rep', 'sales_manager'].includes(role))

  const quickActions = [
    ...(createOrderHref ? [{ label: 'Create Order', href: createOrderHref, icon: Plus }] : []),
    ...(mode === 'admin' ? [{ label: 'Add Delivery', href: '/admin/deliveries/new', icon: Truck }] : []),
    { label: 'Add Tasting', href: `/${mode}/tastings?account=${account.id}`, icon: CalendarDays },
    { label: 'Add Note', href: getTabHref(basePath, 'notes-activity'), icon: FileText },
  ]

  const tabLinks = ACCOUNT_TABS.map((item) => ({
    ...item,
    href: getTabHref(basePath, item.id),
  }))

  let overviewData:
    | {
        accountContacts: Array<{ id: string; name: string; title: string | null; email: string | null; phone: string | null; isPrimary: boolean }>
        recentOrders: Array<{ id: string; status: string; total: string; createdAt: Date }>
        recentInvoices: Array<{ id: string; invoiceNumber: string; dueDate: string | null; total: string; status: string }>
        orderCount: { total: number }
        recentDeliveries: Array<{ deliveryId: string; status: string; weekStartDate: string; stopStatus: string; completedAt: Date | null; proofOfDeliveryUrl: string | null; shelfPhotoUrl: string | null }>
        recentTexts: Array<{ id: string; direction: string; body: string; createdAt: Date; phoneNumber: string }>
        recentTastings: Array<{ id: string; eventName: string; status: string; scheduledAt: Date; endAt: Date | null; reportSubmittedAt: Date | null }>
        notes: Awaited<ReturnType<typeof getAccountNotes>>
        inventoryItems: Awaited<ReturnType<typeof getAccountInventoryOnHand>>
        activityItems: Awaited<ReturnType<typeof getAccountActivityFeed>>
        mediaItems: Awaited<ReturnType<typeof getAccountMediaFeed>>
        smartInsights: Awaited<ReturnType<typeof generateAccountSmartInsights>>
      }
    | null = null

  let ordersData:
    | {
        recentOrders: Array<{ id: string; status: string; total: string; createdAt: Date }>
        recentInvoices: Array<{ id: string; invoiceNumber: string; dueDate: string | null; total: string; status: string }>
        recentDeliveries: Array<{ deliveryId: string; status: string; weekStartDate: string; stopStatus: string; completedAt: Date | null; proofOfDeliveryUrl: string | null; shelfPhotoUrl: string | null }>
        recentTastings: Array<{ id: string; eventName: string; status: string; scheduledAt: Date; endAt: Date | null; reportSubmittedAt: Date | null }>
      }
    | null = null

  let contactsData:
    | {
        accountContacts: Array<{ id: string; name: string; title: string | null; email: string | null; phone: string | null; isPrimary: boolean }>
        recentTexts: Array<{ id: string; direction: string; body: string; createdAt: Date; phoneNumber: string; mediaUrls: string[] | null }>
      }
    | null = null

  let inventoryData:
    | {
        inventoryItems: Awaited<ReturnType<typeof getAccountInventoryOnHand>>
        inventoryHistory: Awaited<ReturnType<typeof getAccountInventoryHistory>>
        productOptions: Awaited<ReturnType<typeof getAvailableInventoryProducts>>
      }
    | null = null

  let notesActivityData:
    | {
        notes: Awaited<ReturnType<typeof getAccountNotes>>
        activityItems: Awaited<ReturnType<typeof getAccountActivityFeed>>
      }
    | null = null

  let mediaData: Awaited<ReturnType<typeof getAccountMediaFeed>> | null = null

  if (tab === 'overview') {
    const [
      accountContactsResult,
      recentOrdersResult,
      recentInvoicesResult,
      orderCountResult,
      recentDeliveriesResult,
      recentTextsResult,
      recentTastingsResult,
      notes,
      inventoryItems,
      activityItems,
      mediaItems,
    ] = await Promise.allSettled([
      db.select({
        id: contacts.id,
        name: contacts.name,
        title: contacts.title,
        email: contacts.email,
        phone: contacts.phone,
        isPrimary: contacts.isPrimary,
      }).from(contacts).where(eq(contacts.customerId, accountId)).orderBy(desc(contacts.createdAt)).limit(5),
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
        proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
        shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
      }).from(deliveryStops).innerJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id)).where(eq(deliveryStops.customerId, accountId)).orderBy(desc(deliveries.createdAt)).limit(6),
      accountPhones.length
        ? db.select({
            id: smsMessages.id,
            direction: smsMessages.direction,
            body: smsMessages.body,
            createdAt: smsMessages.createdAt,
            phoneNumber: smsMessages.phoneNumber,
          }).from(smsMessages).where(inArray(smsMessages.phoneNumber, accountPhones)).orderBy(desc(smsMessages.createdAt)).limit(6)
        : Promise.resolve([]),
      db.select({
        id: tastings.id,
        eventName: tastings.eventName,
        status: tastings.status,
        scheduledAt: tastings.scheduledAt,
        endAt: tastings.endAt,
        reportSubmittedAt: tastingReports.submittedAt,
      }).from(tastings).leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id)).where(eq(tastings.customerId, accountId)).orderBy(desc(tastings.scheduledAt)).limit(6),
      getAccountNotes(accountId),
      getAccountInventoryOnHand(accountId),
      getAccountActivityFeed(accountId, mode),
      getAccountMediaFeed(accountId, accountPhones, mode, 6),
    ])

    const resolvedOverviewData = {
      accountContacts: accountContactsResult.status === 'fulfilled' ? accountContactsResult.value : [],
      recentOrders: recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : [],
      recentInvoices: recentInvoicesResult.status === 'fulfilled' ? recentInvoicesResult.value : [],
      orderCount: orderCountResult.status === 'fulfilled' ? orderCountResult.value[0] : { total: 0 },
      recentDeliveries: recentDeliveriesResult.status === 'fulfilled' ? recentDeliveriesResult.value : [],
      recentTexts: recentTextsResult.status === 'fulfilled' ? recentTextsResult.value : [],
      recentTastings: recentTastingsResult.status === 'fulfilled' ? recentTastingsResult.value : [],
      notes: notes.status === 'fulfilled' ? notes.value : [],
      inventoryItems: inventoryItems.status === 'fulfilled' ? inventoryItems.value : [],
      activityItems: activityItems.status === 'fulfilled' ? activityItems.value : [],
      mediaItems: mediaItems.status === 'fulfilled' ? mediaItems.value : [],
    }

    const smartInsights = await generateAccountSmartInsights({
      account,
      accountContacts: resolvedOverviewData.accountContacts,
      recentOrders: resolvedOverviewData.recentOrders,
      recentDeliveries: resolvedOverviewData.recentDeliveries,
      recentTastings: resolvedOverviewData.recentTastings,
      recentTexts: resolvedOverviewData.recentTexts,
      notes: resolvedOverviewData.notes,
      inventoryItems: resolvedOverviewData.inventoryItems,
      activityItems: resolvedOverviewData.activityItems,
      mode,
      regionName: assignedRegion?.name ?? null,
    })

    overviewData = {
      ...resolvedOverviewData,
      smartInsights,
    }
  }

  if (tab === 'orders') {
    const [recentOrders, recentInvoices, recentDeliveries, recentTastings] = await Promise.all([
      db.select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
      }).from(orders).where(eq(orders.customerId, accountId)).orderBy(desc(orders.createdAt)).limit(20),
      db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        total: invoices.total,
        status: invoices.status,
      }).from(invoices).where(eq(invoices.customerId, accountId)).orderBy(desc(invoices.createdAt)).limit(20),
      db.select({
        deliveryId: deliveries.id,
        status: deliveries.status,
        weekStartDate: deliveries.weekStartDate,
        stopStatus: deliveryStops.status,
        completedAt: deliveryStops.completedAt,
        proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
        shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
      }).from(deliveryStops).innerJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id)).where(eq(deliveryStops.customerId, accountId)).orderBy(desc(deliveries.createdAt)).limit(20),
      db.select({
        id: tastings.id,
        eventName: tastings.eventName,
        status: tastings.status,
        scheduledAt: tastings.scheduledAt,
        endAt: tastings.endAt,
        reportSubmittedAt: tastingReports.submittedAt,
      }).from(tastings).leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id)).where(eq(tastings.customerId, accountId)).orderBy(desc(tastings.scheduledAt)).limit(20),
    ])

    ordersData = { recentOrders, recentInvoices, recentDeliveries, recentTastings }
  }

  if (tab === 'contacts') {
    const [accountContacts, recentTexts] = await Promise.all([
      db.select({
        id: contacts.id,
        name: contacts.name,
        title: contacts.title,
        email: contacts.email,
        phone: contacts.phone,
        isPrimary: contacts.isPrimary,
      }).from(contacts).where(eq(contacts.customerId, accountId)).orderBy(desc(contacts.createdAt)),
      accountPhones.length
        ? db.select({
            id: smsMessages.id,
            direction: smsMessages.direction,
            body: smsMessages.body,
            createdAt: smsMessages.createdAt,
            phoneNumber: smsMessages.phoneNumber,
            mediaUrls: smsMessages.mediaUrls,
          }).from(smsMessages).where(inArray(smsMessages.phoneNumber, accountPhones)).orderBy(desc(smsMessages.createdAt)).limit(20)
        : Promise.resolve([]),
    ])
    contactsData = { accountContacts, recentTexts }
  }

  if (tab === 'inventory') {
    const [inventoryItems, inventoryHistory, productOptions] = await Promise.all([
      getAccountInventoryOnHand(accountId),
      getAccountInventoryHistory(accountId),
      getAvailableInventoryProducts(),
    ])
    inventoryData = { inventoryItems, inventoryHistory, productOptions }
  }

  if (tab === 'notes-activity') {
    const [notes, activityItems] = await Promise.all([
      getAccountNotes(accountId),
      getAccountActivityFeed(accountId, mode),
    ])
    notesActivityData = { notes, activityItems }
  }

  if (tab === 'media') {
    mediaData = await getAccountMediaFeed(accountId, accountPhones, mode)
  }

  const headerBadges = [
    { label: account.id.slice(-8).toUpperCase(), variant: 'outline' as const },
    { label: account.paymentTerms ?? 'PREPAID', variant: 'secondary' as const },
    account.hubspotContactId || account.hubspotCompanyId
      ? { label: 'HubSpot Synced', variant: 'success' as const }
      : { label: 'Not synced', variant: 'outline' as const },
  ]

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Link href={getAccountIndexPath(mode)}>
                <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold text-slate-900">{account.companyName}</h1>
                  {headerBadges.map((badge) => (
                    <Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>
                  ))}
                </div>
                {(account.city || account.state) ? (
                  <p className="mt-1 text-sm text-muted-foreground">{[account.city, account.state].filter(Boolean).join(', ')}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showViewAs ? <ViewAsAccountButton accountId={account.id} companyName={account.companyName} /> : null}
            {showSyncAction ? (
              <form action={syncToHubSpot.bind(null, account.id)}>
                <Button variant="outline" size="sm" type="submit">
                  <RefreshCw className="mr-2 h-4 w-4" />Sync HubSpot
                </Button>
              </form>
            ) : null}
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <Button variant="outline" size="sm">
                  <action.icon className="mr-2 h-4 w-4" />{action.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="w-full">
          <AccountRecordTabs tabs={tabLinks} currentTab={tab} />
        </div>
      </div>

      {tab === 'overview' && overviewData ? (() => {
        const creditAvailable = Math.max(0, Number(account.creditLimit ?? 0) - Number(account.balance ?? 0))
        const inventoryCasesTotal = overviewData.inventoryItems.reduce((sum, item) => sum + Number(item.casesOnHand || 0), 0)
        const inventoryBottlesTotal = overviewData.inventoryItems.reduce((sum, item) => sum + Number(item.bottlesOnHand || 0), 0)
        const accountHealthSignals = [
          Number(account.balance ?? 0) > 0 ? { label: 'Outstanding balance', ok: false } : { label: 'No outstanding balance', ok: true },
          overviewData.recentTexts.some((message) => message.direction === 'inbound') ? { label: 'Open text activity', ok: false } : { label: 'No open text activity', ok: true },
          overviewData.recentDeliveries.some((delivery) => delivery.stopStatus === 'failed') ? { label: 'Delivery issues on file', ok: false } : { label: 'Delivery history stable', ok: true },
          overviewData.recentOrders.length === 0 ? { label: 'No recent orders', ok: false } : { label: 'Recent ordering activity', ok: true },
          overviewData.recentTastings.some((tasting) => tasting.status === 'completed') ? { label: 'Tasting activity on account', ok: true } : { label: 'No completed tastings yet', ok: true },
        ]
        const healthScore = Math.round((accountHealthSignals.filter((signal) => signal.ok).length / accountHealthSignals.length) * 100)

        return (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
              <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance Due</p><p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(account.balance ?? '0')}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit Available</p><p className="mt-1 text-2xl font-bold">{formatCurrency(creditAvailable.toFixed(2))}</p><p className="mt-0.5 text-xs text-muted-foreground">of {formatCurrency(account.creditLimit ?? '0')} limit</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Orders</p><p className="mt-1 text-2xl font-bold">{overviewData.orderCount.total}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member Since</p><p className="mt-1 text-lg font-bold" suppressHydrationWarning>{formatDate(account.createdAt)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inventory On Hand</p><p className="mt-1 text-2xl font-bold">{inventoryCasesTotal.toFixed(2)} cases</p><p className="mt-0.5 text-xs text-muted-foreground">{inventoryBottlesTotal.toFixed(2)} bottles across {overviewData.inventoryItems.length} items</p></CardContent></Card>
            </div>

            <AccountSmartInsightsCard insights={overviewData.smartInsights} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                <AccountDetailsCard account={account} mode={mode} />
                <AccountNotesCard accountId={account.id} notes={overviewData.notes} currentUserId={currentUserId} currentUserRoles={currentUserRoles} maxItems={3} href={getTabHref(basePath, 'notes-activity')} />
                <AccountActivityCard items={overviewData.activityItems} showFilters={false} maxItems={8} href={getTabHref(basePath, 'notes-activity')} />
                <Card>
                  <CardHeader className="pb-3"><CardTitle>Account Health</CardTitle></CardHeader>
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
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><RefreshCcw className="h-4 w-4" />Sync Status Center</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">HubSpot</p><p className="mt-2 text-sm font-semibold text-slate-900">{account.hubspotContactId || account.hubspotCompanyId ? 'Connected' : 'Needs sync'}</p><p className="mt-1 text-xs text-slate-500">{account.hubspotCompanyId ? `Company ${account.hubspotCompanyId}` : 'No HubSpot company linked'}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">SMS</p><p className="mt-2 text-sm font-semibold text-slate-900">{overviewData.recentTexts.length ? 'Conversation history available' : 'No texts logged yet'}</p><p className="mt-1 text-xs text-slate-500">{accountPhones[0] ?? 'No account phone on file'}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Deliveries</p><p className="mt-2 text-sm font-semibold text-slate-900">{overviewData.recentDeliveries.length ? 'Delivery history linked' : 'No delivery history yet'}</p><p className="mt-1 text-xs text-slate-500">{overviewData.recentDeliveries[0] ? `Latest stop ${overviewData.recentDeliveries[0].stopStatus}` : 'Awaiting first route assignment'}</p></div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle>Contacts</CardTitle><Link href={getContactsPath(mode, account.id)} className="text-xs font-medium text-blue-600 hover:underline">Manage</Link></CardHeader>
                  <CardContent>
                    {overviewData.accountContacts.length === 0 ? <p className="text-sm text-slate-500">No contacts yet.</p> : (
                      <div className="space-y-3">
                        {overviewData.accountContacts.map((contact) => (
                          <div key={contact.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{contact.name}</p>
                              {contact.isPrimary ? <Badge variant="info" className="text-xs">Primary</Badge> : null}
                            </div>
                            {contact.title ? <p className="text-xs text-muted-foreground">{contact.title}</p> : null}
                            {contact.email ? <p className="text-xs text-muted-foreground">{contact.email}</p> : null}
                            {contact.phone ? <PhoneSmsButton phone={contact.phone} recipientName={contact.name} accountId={account.id} className="text-xs" /> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <AccountMapCard
                  companyName={account.companyName}
                  address={account.address}
                  city={account.city}
                  state={account.state}
                  zip={account.zip}
                  lat={account.lat}
                  lng={account.lng}
                  regionName={assignedRegion?.name ?? null}
                />

                <AccountInventorySummaryCard
                  items={overviewData.inventoryItems.slice(0, 5)}
                  totalCases={inventoryCasesTotal}
                  totalBottles={inventoryBottlesTotal}
                  href={getTabHref(basePath, 'inventory')}
                />

                {overviewData.recentInvoices.length > 0 ? (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" />Invoices</CardTitle>{invoicingIndexHref ? <Link href={invoicingIndexHref} className="text-xs font-medium text-blue-600 hover:underline">View all</Link> : null}</CardHeader>
                    <CardContent className="space-y-2">
                      {overviewData.recentInvoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                          <div><p className="text-sm font-medium">{invoice.invoiceNumber}</p>{invoice.dueDate ? <p className="text-xs text-muted-foreground">Due {formatDate(invoice.dueDate)}</p> : null}</div>
                          <div className="text-right"><p className="text-sm font-semibold">{formatCurrency(invoice.total)}</p><Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'destructive' : invoice.status === 'sent' ? 'info' : 'secondary'} className="text-xs">{invoice.status}</Badge></div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle>Recent Orders</CardTitle><Link href={getTabHref(basePath, 'orders')} className="text-xs font-medium text-blue-600 hover:underline">Open tab</Link></CardHeader>
                  <CardContent>
                    {overviewData.recentOrders.length === 0 ? <p className="text-sm text-slate-500">No orders yet.</p> : (
                      <div className="space-y-2">
                        {overviewData.recentOrders.map((order) => {
                          const orderHref = getOrderDetailPath(mode, order.id)
                          const content = (
                            <div className={`flex items-center justify-between rounded px-2 py-2 transition-colors ${orderHref ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                              <div><p className="text-sm font-medium">#{order.id.slice(-8).toUpperCase()}</p><p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(order.createdAt)}</p></div>
                              <div className="text-right"><p className="text-sm font-semibold">{formatCurrency(order.total)}</p><Badge variant="secondary" className="text-xs">{order.status}</Badge></div>
                            </div>
                          )
                          return orderHref ? <Link key={order.id} href={orderHref}>{content}</Link> : <div key={order.id}>{content}</div>
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />Delivery Reports</CardTitle><Link href={getTabHref(basePath, 'orders')} className="text-xs font-medium text-blue-600 hover:underline">Open tab</Link></CardHeader>
                  <CardContent>
                    {overviewData.recentDeliveries.length === 0 ? <p className="text-sm text-slate-500">No deliveries linked to this account yet.</p> : (
                      <div className="space-y-2">
                        {overviewData.recentDeliveries.map((delivery) => {
                          const deliveryHref = getDeliveryReportPath(mode, delivery.deliveryId)
                          const hasReportMedia = Boolean(delivery.proofOfDeliveryUrl || delivery.shelfPhotoUrl)
                          return (
                            <div key={`${delivery.deliveryId}-${String(delivery.completedAt ?? delivery.weekStartDate)}`} className="rounded-xl border border-slate-100 px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">Delivery {String(delivery.deliveryId).slice(-8).toUpperCase()}</p>
                                  <p className="text-xs text-muted-foreground">{String(delivery.weekStartDate)}  -  Stop {delivery.stopStatus}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge variant={hasReportMedia ? 'success' : 'secondary'} className="text-xs">{hasReportMedia ? 'Report media on file' : 'No media attached'}</Badge>
                                    <Badge variant="secondary" className="text-xs">{delivery.status}</Badge>
                                  </div>
                                </div>
                                {deliveryHref ? <Link href={deliveryHref} className="text-xs font-medium text-blue-600 hover:underline">View delivery</Link> : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Taster Reports</CardTitle><Link href={getTabHref(basePath, 'orders')} className="text-xs font-medium text-blue-600 hover:underline">Open tab</Link></CardHeader>
                  <CardContent>
                    {overviewData.recentTastings.length === 0 ? <p className="text-sm text-slate-500">No tastings linked to this account yet.</p> : (
                      <div className="space-y-2">
                        {overviewData.recentTastings.map((tasting) => (
                          <div key={tasting.id} className="rounded-xl border border-slate-100 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{tasting.eventName}</p>
                                <p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(tasting.scheduledAt)}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Badge variant={tasting.reportSubmittedAt ? 'success' : 'warning'} className="text-xs">{tasting.reportSubmittedAt ? 'Report submitted' : 'Report pending'}</Badge>
                                  <Badge variant="secondary" className="text-xs">{tasting.status}</Badge>
                                </div>
                              </div>
                              <Link href={getTastingReportPath(mode, tasting.id)} className="text-xs font-medium text-blue-600 hover:underline">{getTastingReportLinkLabel(mode, Boolean(tasting.reportSubmittedAt))}</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Recent Texts</CardTitle>{mode !== 'sales' && accountPhones[0] ? <Link href={`/${mode}/inbox?phone=${encodeURIComponent(accountPhones[0])}`} className="text-xs font-medium text-blue-600 hover:underline">Open thread</Link> : null}</CardHeader>
                  <CardContent>
                    {overviewData.recentTexts.length === 0 ? <p className="text-sm text-slate-500">No inbox history found for this account yet.</p> : (
                      <div className="space-y-2">
                        {overviewData.recentTexts.map((message) => (
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

                <AccountMediaGalleryCard items={overviewData.mediaItems} title="Media Preview" href={getTabHref(basePath, 'media')} />
              </div>
            </div>
          </>
        )
      })() : null}

      {tab === 'orders' && ordersData ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle>Order History</CardTitle></CardHeader>
            <CardContent>{ordersData.recentOrders.length === 0 ? <p className="text-sm text-slate-500">No orders yet.</p> : <div className="space-y-2">{ordersData.recentOrders.map((order) => {
              const orderHref = getOrderDetailPath(mode, order.id)
              const content = <div className={`flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 ${orderHref ? 'hover:bg-slate-50' : ''}`}><div><p className="text-sm font-medium">#{order.id.slice(-8).toUpperCase()}</p><p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(order.createdAt)}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatCurrency(order.total)}</p><Badge variant="secondary" className="text-xs">{order.status}</Badge></div></div>
              return orderHref ? <Link key={order.id} href={orderHref}>{content}</Link> : <div key={order.id}>{content}</div>
            })}</div>}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent>{ordersData.recentInvoices.length === 0 ? <p className="text-sm text-slate-500">No invoices yet.</p> : <div className="space-y-2">{ordersData.recentInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"><div><p className="text-sm font-medium">{invoice.invoiceNumber}</p>{invoice.dueDate ? <p className="text-xs text-muted-foreground">Due {formatDate(invoice.dueDate)}</p> : null}</div><div className="text-right"><p className="text-sm font-semibold">{formatCurrency(invoice.total)}</p><Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'destructive' : invoice.status === 'sent' ? 'info' : 'secondary'} className="text-xs">{invoice.status}</Badge></div></div>)}</div>}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle>Delivery Reports</CardTitle></CardHeader>
            <CardContent>{ordersData.recentDeliveries.length === 0 ? <p className="text-sm text-slate-500">No deliveries linked to this account yet.</p> : <div className="space-y-2">{ordersData.recentDeliveries.map((delivery) => {
              const deliveryHref = getDeliveryReportPath(mode, delivery.deliveryId)
              const hasReportMedia = Boolean(delivery.proofOfDeliveryUrl || delivery.shelfPhotoUrl)
              return <div key={`${delivery.deliveryId}-${String(delivery.completedAt ?? delivery.weekStartDate)}`} className="rounded-xl border border-slate-100 px-3 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-900">Delivery {String(delivery.deliveryId).slice(-8).toUpperCase()}</p><p className="text-xs text-muted-foreground">{String(delivery.weekStartDate)}  -  Stop {delivery.stopStatus}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={hasReportMedia ? 'success' : 'secondary'} className="text-xs">{hasReportMedia ? 'Report media on file' : 'No media attached'}</Badge><Badge variant="secondary" className="text-xs">{delivery.status}</Badge></div></div>{deliveryHref ? <Link href={deliveryHref} className="text-xs font-medium text-blue-600 hover:underline">View delivery</Link> : null}</div></div>
            })}</div>}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle>Taster Reports</CardTitle></CardHeader>
            <CardContent>{ordersData.recentTastings.length === 0 ? <p className="text-sm text-slate-500">No tastings linked to this account yet.</p> : <div className="space-y-2">{ordersData.recentTastings.map((tasting) => <div key={tasting.id} className="rounded-xl border border-slate-100 px-3 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-900">{tasting.eventName}</p><p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(tasting.scheduledAt)}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={tasting.reportSubmittedAt ? 'success' : 'warning'} className="text-xs">{tasting.reportSubmittedAt ? 'Report submitted' : 'Report pending'}</Badge><Badge variant="secondary" className="text-xs">{tasting.status}</Badge></div></div><Link href={getTastingReportPath(mode, tasting.id)} className="text-xs font-medium text-blue-600 hover:underline">{getTastingReportLinkLabel(mode, Boolean(tasting.reportSubmittedAt))}</Link></div></div>)}</div>}</CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'contacts' && contactsData ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle>Contacts</CardTitle><Link href={getContactsPath(mode, account.id)} className="text-xs font-medium text-blue-600 hover:underline">Manage contacts</Link></CardHeader>
            <CardContent>{contactsData.accountContacts.length === 0 ? <p className="text-sm text-slate-500">No contacts yet.</p> : <div className="space-y-3">{contactsData.accountContacts.map((contact) => <div key={contact.id} className="rounded-xl border border-slate-100 px-3 py-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{contact.name}</p>{contact.isPrimary ? <Badge variant="info" className="text-xs">Primary</Badge> : null}</div>{contact.title ? <p className="text-xs text-muted-foreground">{contact.title}</p> : null}{contact.email ? <p className="text-xs text-muted-foreground">{contact.email}</p> : null}{contact.phone ? <PhoneSmsButton phone={contact.phone} recipientName={contact.name} accountId={account.id} className="text-xs" /> : null}</div>)}</div>}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle>Communication</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Notification preference</p>
                <div className="mt-2">{account.notificationPreference === 'sms' ? <Badge variant="info">SMS only</Badge> : account.notificationPreference === 'both' ? <div className="flex gap-2"><Badge variant="info">SMS</Badge><Badge variant="secondary">Email</Badge></div> : <Badge variant="secondary">Email only</Badge>}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-900">Recent SMS / MMS</p>
                {contactsData.recentTexts.length === 0 ? <p className="text-sm text-slate-500">No communication history found yet.</p> : <div className="space-y-2">{contactsData.recentTexts.map((message) => <div key={message.id} className="rounded-xl border border-slate-100 px-3 py-3"><div className="flex items-center justify-between gap-3"><Badge variant={message.direction === 'inbound' ? 'warning' : 'secondary'}>{message.direction}</Badge><span className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDate(message.createdAt)}</span></div><p className="mt-2 text-sm text-slate-700">{message.body}</p>{message.mediaUrls?.length ? <p className="mt-1 text-xs text-slate-500">{message.mediaUrls.length} media attachment{message.mediaUrls.length === 1 ? '' : 's'}</p> : null}</div>)}</div>}
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">Call logs and email logs are not yet centralized in this tab.</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'inventory' && inventoryData ? (
        <AccountInventoryOnHandCard accountId={account.id} items={inventoryData.inventoryItems} historyEvents={inventoryData.inventoryHistory} products={inventoryData.productOptions} showHistory={mode === 'admin' || mode === 'sales'} />
      ) : null}

      {tab === 'notes-activity' && notesActivityData ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AccountNotesCard accountId={account.id} notes={notesActivityData.notes} currentUserId={currentUserId} currentUserRoles={currentUserRoles} />
          <AccountActivityCard items={notesActivityData.activityItems} />
        </div>
      ) : null}

      {tab === 'media' && mediaData ? (
        <div className="space-y-6">
          {canUploadAccountMedia ? <AccountMediaUploadCard accountId={account.id} /> : null}
          {canUseMediaInsights ? <AccountMediaInsightsCard accountId={account.id} /> : null}
          <AccountMediaGalleryCard items={mediaData} title="Account Media" />
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Card id="edit-account">
              <CardHeader className="pb-3"><CardTitle>Account Setup / Edit</CardTitle></CardHeader>
              <CardContent><AccountEditForm account={account} mode={mode} salesLeadOptions={salesLeadOptions} /></CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><RefreshCcw className="h-4 w-4" />Sync Status Center</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">HubSpot</p><p className="mt-2 text-sm font-semibold text-slate-900">{account.hubspotContactId || account.hubspotCompanyId ? 'Connected' : 'Needs sync'}</p><p className="mt-1 text-xs text-slate-500">{account.hubspotCompanyId ? `Company ${account.hubspotCompanyId}` : 'No HubSpot company linked'}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Notification preference</p><p className="mt-2 text-sm font-semibold text-slate-900">{account.notificationPreference ?? 'email'}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Payment terms</p><p className="mt-2 text-sm font-semibold text-slate-900">{account.paymentTerms ?? 'PREPAID'}</p></div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}




