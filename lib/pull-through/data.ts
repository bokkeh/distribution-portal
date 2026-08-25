/**
 * Pull-Through data access.
 *
 * Reads exclusively from tables that already exist. This module creates nothing and
 * caches nothing: each call recomputes from the live records, which is why a corrected
 * tasting report or a new order shows up on the dashboard without a "refresh report"
 * step anywhere.
 */

import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import {
  accountInventoryAdjustments,
  accountInventoryOnHand,
  accountNotes,
  activityEvents,
  contacts,
  customerAccounts,
  orderItems,
  orders,
  products,
  salesMembers,
  salesRegions,
  salesRouteStops,
  salesRoutes,
  tastingReports,
  tastings,
  users,
} from '@/db/schema'
import type { Session } from 'next-auth'
import {
  attachTastingOrderAttribution,
  collectDataQualityFlags,
  computeInventoryPosition,
  computeOrderMetrics,
  computePullThroughScore,
  computeTastingMetrics,
  daysBetween,
  deriveTemperature,
  recommendAction,
  type ConfirmedInventoryInput,
} from './metrics'
import type {
  PullThroughAccountRow,
  PullThroughOrder,
  PullThroughTasting,
  SourceRef,
  TimelineEvent,
  ViewerMode,
} from './types'

const DEFAULT_BOTTLES_PER_CASE = 12

/* ------------------------------------------------------------------- paths */

export function accountBasePath(mode: ViewerMode, accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}` : `/${mode}/crm/${accountId}`
}

export function accountContactsPath(mode: ViewerMode, accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}/contacts` : `/${mode}/crm/${accountId}/contacts`
}

export function orderDetailPath(mode: ViewerMode, orderId: string) {
  return mode === 'sales' ? null : `/${mode}/orders/${orderId}`
}

export function tastingDetailPath(mode: ViewerMode, tastingId: string) {
  if (mode === 'admin') return `/admin/tastings/${tastingId}`
  if (mode === 'staff') return '/staff/tastings/reports'
  return '/sales/tastings'
}

export function pullThroughBasePath(mode: ViewerMode) {
  return mode === 'sales' ? '/sales/pull-through' : `/${mode}/pull-through`
}

/* ------------------------------------------------------------------- scope */

export type PullThroughScope = {
  mode: ViewerMode
  /** null means "every account" (admin / staff). */
  accountIds: string[] | null
  canSeeAllAccounts: boolean
  salesMemberId: string | null
  /** Sales member ids this viewer is allowed to report on (self + direct reports). */
  visibleSalesMemberIds: string[] | null
  viewerLabel: string
}

/**
 * Resolves what this viewer is allowed to see, using the portal's existing roles and
 * sales-ownership records. Nobody gains visibility here that they do not already have
 * on the CRM and account pages.
 */
export async function resolvePullThroughScope(session: Session): Promise<PullThroughScope> {
  const roles = session.user.roles ?? [session.user.role as string]

  const [member] = await db
    .select({ id: salesMembers.id })
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  const salesMemberId = member?.id ?? null

  if (roles.includes('admin') || roles.includes('staff')) {
    return {
      mode: roles.includes('admin') ? 'admin' : 'staff',
      accountIds: null,
      canSeeAllAccounts: true,
      salesMemberId,
      visibleSalesMemberIds: null,
      viewerLabel: 'All accounts',
    }
  }

  // Sales managers see their own book plus everything their direct reports own.
  if (roles.includes('sales_manager') && salesMemberId) {
    const reports = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.managerId, salesMemberId))

    const memberIds = [salesMemberId, ...reports.map((row) => row.id)]

    const owned = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(inArray(customerAccounts.assignedSalesRepId, memberIds))

    return {
      mode: 'sales',
      accountIds: owned.map((row) => row.id),
      canSeeAllAccounts: false,
      salesMemberId,
      visibleSalesMemberIds: memberIds,
      viewerLabel: 'My team',
    }
  }

  if (salesMemberId) {
    const owned = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(eq(customerAccounts.assignedSalesRepId, salesMemberId))

    return {
      mode: 'sales',
      accountIds: owned.map((row) => row.id),
      canSeeAllAccounts: false,
      salesMemberId,
      visibleSalesMemberIds: [salesMemberId],
      viewerLabel: 'My accounts',
    }
  }

  return {
    mode: 'sales',
    accountIds: [],
    canSeeAllAccounts: false,
    salesMemberId: null,
    visibleSalesMemberIds: [],
    viewerLabel: 'No assigned accounts',
  }
}

/** True when this viewer may open the given account's intelligence. */
export function scopeAllowsAccount(scope: PullThroughScope, accountId: string) {
  if (scope.canSeeAllAccounts) return true
  return (scope.accountIds ?? []).includes(accountId)
}

/* ------------------------------------------------------------- raw loaders */

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Order history with case/bottle quantities resolved through the product record's
 * bottles-per-case, so bottle counts are never entered by hand.
 */
async function loadOrders(accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, PullThroughOrder[]>()

  const rows = await db
    .select({
      id: orders.id,
      accountId: orders.customerId,
      orderedAt: orders.createdAt,
      orderType: orders.orderType,
      status: orders.status,
      total: orders.total,
      cases: sql<number>`coalesce(sum(case when ${orderItems.unit} = 'case' then ${orderItems.quantity}::numeric else 0 end), 0)::float`,
      bottles: sql<number>`coalesce(sum(
        case when ${orderItems.unit} = 'case'
          then ${orderItems.quantity}::numeric * coalesce(${products.bottlesPerCase}, ${DEFAULT_BOTTLES_PER_CASE})
          else ${orderItems.quantity}::numeric
        end
      ), 0)::float`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(inArray(orders.customerId, accountIds), ne(orders.status, 'cancelled')))
    .groupBy(orders.id, orders.customerId, orders.createdAt, orders.orderType, orders.status, orders.total)
    .orderBy(asc(orders.createdAt))

  const byAccount = new Map<string, PullThroughOrder[]>()

  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? []
    list.push({
      id: row.id,
      accountId: row.accountId,
      orderedAt: new Date(row.orderedAt),
      orderType: row.orderType as 'paid' | 'sample',
      status: row.status,
      cases: toNumber(row.cases),
      bottles: toNumber(row.bottles),
      total: toNumber(row.total),
      sequenceIndex: 0,
      isReorder: false,
    })
    byAccount.set(row.accountId, list)
  }

  // Reorder position is derived, never stored: order 1 is the initial order,
  // order 2 is the first reorder, and so on.
  for (const list of byAccount.values()) {
    const commercial = list.filter((order) => order.orderType === 'paid')
    commercial.forEach((order, index) => {
      order.sequenceIndex = index
      order.isReorder = index > 0
    })
  }

  return byAccount
}

export async function loadTastings(accountIds: string[], mode: ViewerMode) {
  if (accountIds.length === 0) return new Map<string, PullThroughTasting[]>()

  const reportSubmitter = alias(users, 'report_submitter')

  const rows = await db
    .select({
      id: tastings.id,
      accountId: tastings.customerId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      checkedInAt: tastings.checkedInAt,
      status: tastings.status,
      tasterUserId: tastings.assignedUserId,
      tasterName: users.name,
      reportId: tastingReports.id,
      actualStartTime: tastingReports.actualStartTime,
      actualEndTime: tastingReports.actualEndTime,
      bottlesSold: tastingReports.bottlesSold,
      casesSold: tastingReports.casesSold,
      samplesServed: tastingReports.samplesServed,
      consumerInteractions: tastingReports.consumerInteractions,
      bottlesInStock: tastingReports.bottlesInStock,
      accountFeedback: tastingReports.accountFeedback,
      highlights: tastingReports.highlights,
      issues: tastingReports.issues,
      followUpNeeded: tastingReports.followUpNeeded,
      followUpNotes: tastingReports.followUpNotes,
      setupPhotoUrl: tastingReports.setupPhotoUrl,
      shelfPhotoUrls: tastingReports.shelfPhotoUrls,
      submittedByName: reportSubmitter.name,
    })
    .from(tastings)
    .leftJoin(users, eq(users.id, tastings.assignedUserId))
    .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
    .leftJoin(reportSubmitter, eq(reportSubmitter.id, tastingReports.submittedByUserId))
    .where(inArray(tastings.customerId, accountIds))
    .orderBy(asc(tastings.scheduledAt))

  const byAccount = new Map<string, PullThroughTasting[]>()

  for (const row of rows) {
    // A tasting only counts as having happened once it is checked in or completed.
    if (row.status === 'cancelled' || row.status === 'declined') continue

    const occurredAt = row.checkedInAt ? new Date(row.checkedInAt) : new Date(row.scheduledAt)
    const photoUrls = [row.setupPhotoUrl, ...(row.shelfPhotoUrls ?? [])].filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    )

    const list = byAccount.get(row.accountId) ?? []
    list.push({
      id: row.id,
      accountId: row.accountId,
      eventName: row.eventName,
      occurredAt,
      status: row.status,
      tasterUserId: row.tasterUserId,
      tasterName: row.tasterName,
      hasReport: row.reportId != null,
      reportSubmittedByName: row.submittedByName ?? null,
      startTime: row.actualStartTime,
      endTime: row.actualEndTime,
      bottlesSold: row.bottlesSold,
      casesSold: row.casesSold,
      samplesServed: row.samplesServed,
      consumerInteractions: row.consumerInteractions,
      bottlesInStock: row.bottlesInStock,
      accountFeedback: row.accountFeedback,
      highlights: row.highlights,
      issues: row.issues,
      followUpNeeded: row.followUpNeeded ?? false,
      followUpNotes: row.followUpNotes,
      photoUrls,
      nextOrderId: null,
      nextOrderAt: null,
      nextOrderBottles: null,
      nextOrderCases: null,
      daysToNextOrder: null,
      within7: false,
      within14: false,
      within30: false,
    })
    byAccount.set(row.accountId, list)
  }

  void mode
  return byAccount
}

type InventorySnapshot = ConfirmedInventoryInput & { dominantBottlesPerCase: number }

async function loadInventory(accountIds: string[], mode: ViewerMode) {
  if (accountIds.length === 0) return new Map<string, InventorySnapshot>()

  const rows = await db
    .select({
      accountId: accountInventoryOnHand.accountId,
      productId: accountInventoryOnHand.productId,
      productName: accountInventoryOnHand.productName,
      casesOnHand: accountInventoryOnHand.casesOnHand,
      bottlesOnHand: accountInventoryOnHand.bottlesOnHand,
      bottlesPerCase: products.bottlesPerCase,
      updatedAt: accountInventoryOnHand.updatedAt,
      updatedByName: users.name,
      updatedByRole: users.role,
    })
    .from(accountInventoryOnHand)
    .leftJoin(products, eq(products.id, accountInventoryOnHand.productId))
    .leftJoin(users, eq(users.id, accountInventoryOnHand.updatedByUserId))
    .where(inArray(accountInventoryOnHand.accountId, accountIds))
    .orderBy(desc(accountInventoryOnHand.updatedAt))

  const byAccount = new Map<string, InventorySnapshot>()

  for (const row of rows) {
    const bottlesPerCase = row.bottlesPerCase ?? DEFAULT_BOTTLES_PER_CASE
    const cases = toNumber(row.casesOnHand)
    const bottles = toNumber(row.bottlesOnHand) + cases * bottlesPerCase
    const updatedAt = new Date(row.updatedAt)

    const existing = byAccount.get(row.accountId)

    if (!existing) {
      byAccount.set(row.accountId, {
        bottles,
        cases,
        productCount: 1,
        lastConfirmedAt: updatedAt,
        lastConfirmedByName: row.updatedByName,
        lastConfirmedByRole: row.updatedByRole,
        dominantBottlesPerCase: bottlesPerCase,
        source: {
          label: 'Inventory check',
          at: updatedAt,
          byName: row.updatedByName,
          byRole: row.updatedByRole,
          recordType: 'inventory_on_hand',
          recordId: row.productId,
          href: `${accountBasePath(mode, row.accountId)}?tab=inventory`,
        } satisfies SourceRef,
      })
      continue
    }

    existing.bottles += bottles
    existing.cases += cases
    existing.productCount += 1

    // Provenance follows the most recently touched line for the account.
    if (existing.lastConfirmedAt == null || updatedAt > existing.lastConfirmedAt) {
      existing.lastConfirmedAt = updatedAt
      existing.lastConfirmedByName = row.updatedByName
      existing.lastConfirmedByRole = row.updatedByRole
      existing.source = {
        label: 'Inventory check',
        at: updatedAt,
        byName: row.updatedByName,
        byRole: row.updatedByRole,
        recordType: 'inventory_on_hand',
        recordId: row.productId,
        href: `${accountBasePath(mode, row.accountId)}?tab=inventory`,
      }
    }
  }

  return byAccount
}

async function loadContactSummary(accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, { count: number; primaryName: string | null }>()

  const rows = await db
    .select({
      accountId: contacts.customerId,
      name: contacts.name,
      isPrimary: contacts.isPrimary,
    })
    .from(contacts)
    .where(inArray(contacts.customerId, accountIds))
    .orderBy(desc(contacts.isPrimary), asc(contacts.createdAt))

  const byAccount = new Map<string, { count: number; primaryName: string | null }>()

  for (const row of rows) {
    const existing = byAccount.get(row.accountId) ?? { count: 0, primaryName: null }
    existing.count += 1
    if (existing.primaryName == null) existing.primaryName = row.name
    byAccount.set(row.accountId, existing)
  }

  return byAccount
}

/* --------------------------------------------------------------- dashboard */

export type PullThroughDataset = {
  rows: PullThroughAccountRow[]
  scope: PullThroughScope
  generatedAt: Date
  /** Every taster who has worked each account — drives the taster filter. */
  tasterNamesByAccount: Map<string, string[]>
}

/**
 * Builds one row per account, entirely from connected records.
 */
export async function loadPullThroughDataset(scope: PullThroughScope): Promise<PullThroughDataset> {
  const now = new Date()

  const accountRows = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      county: customerAccounts.county,
      phone: customerAccounts.phone,
      businessPhone: customerAccounts.businessPhone,
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      contactName: customerAccounts.contactName,
      pocName: customerAccounts.pocName,
      accountType: customerAccounts.accountType,
      businessType: customerAccounts.businessType,
      accountPriority: customerAccounts.accountPriority,
      dealStage: customerAccounts.dealStage,
      customerSource: customerAccounts.customerSource,
      createdAt: customerAccounts.createdAt,
      salesRepId: customerAccounts.assignedSalesRepId,
      salesRepUserId: salesMembers.userId,
      salesRepName: users.name,
      territory: salesRegions.name,
    })
    .from(customerAccounts)
    .leftJoin(salesMembers, eq(salesMembers.id, customerAccounts.assignedSalesRepId))
    .leftJoin(users, eq(users.id, salesMembers.userId))
    .leftJoin(salesRegions, eq(salesRegions.id, customerAccounts.assignedRegionId))
    .where(
      and(
        eq(customerAccounts.customerSegment, 'b2b_wholesale'),
        scope.accountIds ? inArray(customerAccounts.id, scope.accountIds.length > 0 ? scope.accountIds : ['00000000-0000-0000-0000-000000000000']) : undefined,
      ),
    )
    .orderBy(asc(customerAccounts.companyName))

  const accountIds = accountRows.map((row) => row.id)

  const [ordersByAccount, tastingsByAccount, inventoryByAccount, contactsByAccount] = await Promise.all([
    loadOrders(accountIds),
    loadTastings(accountIds, scope.mode),
    loadInventory(accountIds, scope.mode),
    loadContactSummary(accountIds),
  ])

  const rows: PullThroughAccountRow[] = accountRows.map((account) => {
    const basePath = accountBasePath(scope.mode, account.id)
    const allOrders = ordersByAccount.get(account.id) ?? []
    const commercialOrders = allOrders.filter((order) => order.orderType === 'paid')
    const sampleOrders = allOrders.filter((order) => order.orderType === 'sample')

    const orderMetrics = computeOrderMetrics(commercialOrders, sampleOrders.length, now)

    const rawTastings = tastingsByAccount.get(account.id) ?? []
    const attributedTastings = attachTastingOrderAttribution(rawTastings, commercialOrders)
    const tastingMetrics = computeTastingMetrics(attributedTastings, commercialOrders)

    const snapshot = inventoryByAccount.get(account.id) ?? null
    const bottlesReceivedSinceCheck =
      snapshot?.lastConfirmedAt != null
        ? commercialOrders
            .filter((order) => order.orderedAt.getTime() > snapshot.lastConfirmedAt!.getTime())
            .reduce((sum, order) => sum + order.bottles, 0)
        : 0

    const inventory = computeInventoryPosition(
      snapshot,
      bottlesReceivedSinceCheck,
      orderMetrics.bottlesPerDay,
      snapshot?.dominantBottlesPerCase ?? DEFAULT_BOTTLES_PER_CASE,
      now,
    )

    const { temperature, why: temperatureWhy } = deriveTemperature(orderMetrics, inventory, tastingMetrics)

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000)
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 86_400_000)
    const recentBottles = {
      last90: commercialOrders
        .filter((order) => order.orderedAt >= ninetyDaysAgo)
        .reduce((sum, order) => sum + order.bottles, 0),
      prior90: commercialOrders
        .filter((order) => order.orderedAt >= oneEightyDaysAgo && order.orderedAt < ninetyDaysAgo)
        .reduce((sum, order) => sum + order.bottles, 0),
    }

    const pullThrough = computePullThroughScore(
      orderMetrics,
      inventory,
      tastingMetrics,
      recentBottles,
      daysBetween(new Date(account.createdAt), now),
    )

    const recommendation = recommendAction(orderMetrics, inventory, tastingMetrics, temperature, now)

    const contactSummary = contactsByAccount.get(account.id) ?? { count: 0, primaryName: null }
    const primaryContactName = contactSummary.primaryName ?? account.pocName ?? account.contactName ?? null

    const dataQuality = collectDataQualityFlags(orderMetrics, inventory, attributedTastings, {
      contactCount: contactSummary.count + (primaryContactName ? 1 : 0),
      hasSalesRep: account.salesRepId != null,
      accountHref: basePath,
      contactsHref: accountContactsPath(scope.mode, account.id),
    })

    const lastOrder = commercialOrders[commercialOrders.length - 1] ?? null
    const lastTasting = attributedTastings[attributedTastings.length - 1] ?? null

    const lastActivityCandidates = [
      orderMetrics.lastOrderAt,
      tastingMetrics.lastTastingAt,
      inventory.lastConfirmedAt,
    ].filter((value): value is Date => value != null)

    return {
      accountId: account.id,
      accountName: account.companyName,
      accountHref: basePath,
      address: account.address,
      city: account.city,
      state: account.state,
      county: account.county,
      market: account.county ?? account.state ?? null,
      territory: account.territory,
      accountType: account.accountType ?? account.businessType,
      accountPriority: account.accountPriority,
      dealStage: account.dealStage,
      distributor: account.customerSource,
      phone: account.phone ?? account.businessPhone,
      email: account.email ?? account.businessEmail,
      primaryContactName,
      contactCount: contactSummary.count,
      salesRepId: account.salesRepId,
      salesRepName: account.salesRepName,
      salesRepUserId: account.salesRepUserId,
      createdAt: new Date(account.createdAt),
      orders: orderMetrics,
      inventory,
      tastings: tastingMetrics,
      temperature,
      temperatureWhy,
      pullThrough,
      recommendation,
      dataQuality,
      lastOrderSource: lastOrder
        ? {
            label: 'Order',
            at: lastOrder.orderedAt,
            recordType: 'order',
            recordId: lastOrder.id,
            href: orderDetailPath(scope.mode, lastOrder.id),
          }
        : null,
      lastTastingSource: lastTasting
        ? {
            label: lastTasting.hasReport ? 'Tasting report' : 'Tasting',
            at: lastTasting.occurredAt,
            byName: lastTasting.tasterName,
            recordType: lastTasting.hasReport ? 'tasting_report' : 'tasting',
            recordId: lastTasting.id,
            href: tastingDetailPath(scope.mode, lastTasting.id),
          }
        : null,
      lastActivityAt:
        lastActivityCandidates.length > 0
          ? new Date(Math.max(...lastActivityCandidates.map((date) => date.getTime())))
          : null,
    }
  })

  const tasterNamesByAccount = new Map<string, string[]>()
  for (const [accountId, list] of tastingsByAccount.entries()) {
    const names = Array.from(
      new Set(list.map((tasting) => tasting.tasterName).filter((name): name is string => !!name)),
    )
    if (names.length > 0) tasterNamesByAccount.set(accountId, names)
  }

  return { rows, scope, generatedAt: now, tasterNamesByAccount }
}

/**
 * Tastings for a set of accounts with their following order already attached.
 * Used by the taster performance rollup so attribution is computed one way only.
 */
export async function loadAttributedTastings(accountIds: string[], mode: ViewerMode) {
  const [tastingsByAccount, ordersByAccount] = await Promise.all([
    loadTastings(accountIds, mode),
    loadOrders(accountIds),
  ])

  const result = new Map<string, PullThroughTasting[]>()
  for (const [accountId, list] of tastingsByAccount.entries()) {
    const commercialOrders = (ordersByAccount.get(accountId) ?? []).filter((order) => order.orderType === 'paid')
    result.set(accountId, attachTastingOrderAttribution(list, commercialOrders))
  }

  return result
}

/* ------------------------------------------------------- single account API */

export type AccountIntelligence = {
  row: PullThroughAccountRow
  tastings: PullThroughTasting[]
  orders: PullThroughOrder[]
  timeline: TimelineEvent[]
}

export async function loadAccountIntelligence(
  accountId: string,
  scope: PullThroughScope,
): Promise<AccountIntelligence | null> {
  const singleScope: PullThroughScope = { ...scope, accountIds: [accountId], canSeeAllAccounts: false }
  const dataset = await loadPullThroughDataset(singleScope)
  const row = dataset.rows[0]
  if (!row) return null

  const [ordersByAccount, tastingsByAccount] = await Promise.all([
    loadOrders([accountId]),
    loadTastings([accountId], scope.mode),
  ])

  const allOrders = ordersByAccount.get(accountId) ?? []
  const commercialOrders = allOrders.filter((order) => order.orderType === 'paid')
  const tastingList = attachTastingOrderAttribution(tastingsByAccount.get(accountId) ?? [], commercialOrders)

  const timeline = await loadAccountTimeline(accountId, scope.mode, allOrders, tastingList)

  return { row, tastings: tastingList, orders: allOrders, timeline }
}

/**
 * Unified timeline. Nothing here is re-entered by a salesperson: every entry is an
 * existing record rendered chronologically and deep-linked back to its source.
 */
export async function loadAccountTimeline(
  accountId: string,
  mode: ViewerMode,
  ordersList: PullThroughOrder[],
  tastingList: PullThroughTasting[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = []

  for (const order of ordersList) {
    const isSample = order.orderType === 'sample'
    events.push({
      id: `order-${order.id}`,
      kind: isSample ? 'sample_order' : order.isReorder ? 'reorder' : 'order',
      at: order.orderedAt,
      title: isSample ? 'Sample order' : order.isReorder ? `Reorder #${order.sequenceIndex}` : 'First order',
      detail: `${order.bottles.toFixed(0)} bottles${order.cases > 0 ? ` (${order.cases.toFixed(0)} cases)` : ''}`,
      actorName: null,
      actorRole: null,
      href: orderDetailPath(mode, order.id),
      sourceLabel: 'Order record',
    })
  }

  for (const tasting of tastingList) {
    const details: string[] = []
    if (tasting.bottlesSold != null) details.push(`${tasting.bottlesSold} bottles sold`)
    if (tasting.samplesServed != null) details.push(`${tasting.samplesServed} samples served`)
    if (tasting.bottlesInStock != null) details.push(`${tasting.bottlesInStock} bottles on shelf`)

    events.push({
      id: `tasting-${tasting.id}`,
      kind: 'tasting',
      at: tasting.occurredAt,
      title: tasting.hasReport ? 'Tasting' : `Tasting (${tasting.status}, no report)`,
      detail: details.length > 0 ? details.join(' · ') : tasting.eventName,
      actorName: tasting.tasterName,
      actorRole: 'taster',
      href: tastingDetailPath(mode, tasting.id),
      sourceLabel: tasting.hasReport ? 'Tasting report' : 'Tasting record',
    })
  }

  const basePath = accountBasePath(mode, accountId)

  const [adjustmentRows, noteRows, activityRows, visitRows] = await Promise.all([
    db
      .select({
        id: accountInventoryAdjustments.id,
        effectiveAt: accountInventoryAdjustments.effectiveAt,
        changeType: accountInventoryAdjustments.changeType,
        productName: accountInventoryAdjustments.productName,
        resultingCases: accountInventoryAdjustments.resultingCasesOnHand,
        resultingBottles: accountInventoryAdjustments.resultingBottlesOnHand,
        notes: accountInventoryAdjustments.notes,
        actorName: users.name,
        actorRole: users.role,
      })
      .from(accountInventoryAdjustments)
      .leftJoin(users, eq(users.id, accountInventoryAdjustments.createdByUserId))
      .where(eq(accountInventoryAdjustments.accountId, accountId))
      .orderBy(desc(accountInventoryAdjustments.effectiveAt))
      .limit(100),
    db
      .select({
        id: accountNotes.id,
        body: accountNotes.noteBody,
        noteType: accountNotes.noteType,
        createdAt: accountNotes.createdAt,
        actorName: users.name,
        actorRole: users.role,
      })
      .from(accountNotes)
      .leftJoin(users, eq(users.id, accountNotes.authorUserId))
      .where(eq(accountNotes.accountId, accountId))
      .orderBy(desc(accountNotes.createdAt))
      .limit(100),
    db
      .select({
        id: activityEvents.id,
        kind: activityEvents.kind,
        title: activityEvents.title,
        body: activityEvents.body,
        createdAt: activityEvents.createdAt,
        actorName: users.name,
        actorRole: users.role,
      })
      .from(activityEvents)
      .leftJoin(users, eq(users.id, activityEvents.actorUserId))
      .where(and(eq(activityEvents.entityType, 'account'), eq(activityEvents.entityId, accountId)))
      .orderBy(desc(activityEvents.createdAt))
      .limit(100),
    db
      .select({
        id: salesRouteStops.id,
        visitedAt: salesRouteStops.visitedAt,
        notes: salesRouteStops.notes,
        routeId: salesRouteStops.routeId,
        routeName: salesRoutes.name,
        repName: users.name,
      })
      .from(salesRouteStops)
      .leftJoin(salesRoutes, eq(salesRoutes.id, salesRouteStops.routeId))
      .leftJoin(users, eq(users.id, salesRoutes.assignedRepUserId))
      .where(and(eq(salesRouteStops.customerId, accountId), isNotNull(salesRouteStops.visitedAt)))
      .orderBy(desc(salesRouteStops.visitedAt))
      .limit(100),
  ])

  for (const row of adjustmentRows) {
    events.push({
      id: `inventory-${row.id}`,
      kind: 'inventory_check',
      at: new Date(row.effectiveAt),
      title: 'Inventory check',
      detail: `${row.productName}: ${toNumber(row.resultingCases).toFixed(0)} cases / ${toNumber(row.resultingBottles).toFixed(0)} bottles remaining${row.notes ? ` — ${row.notes}` : ''}`,
      actorName: row.actorName,
      actorRole: row.actorRole,
      href: `${basePath}?tab=inventory`,
      sourceLabel: 'Inventory adjustment',
    })
  }

  for (const row of noteRows) {
    events.push({
      id: `note-${row.id}`,
      kind: 'note',
      at: new Date(row.createdAt),
      title: row.noteType === 'general_update' ? 'Account note' : row.noteType.replace(/_/g, ' '),
      detail: row.body,
      actorName: row.actorName,
      actorRole: row.actorRole,
      href: `${basePath}?tab=notes-activity`,
      sourceLabel: 'Account note',
    })
  }

  for (const row of activityRows) {
    // Order/tasting/inventory activity is already represented by its own record above.
    if (/^account_inventory_/.test(row.kind)) continue
    events.push({
      id: `activity-${row.id}`,
      kind: 'crm_activity',
      at: new Date(row.createdAt),
      title: row.title,
      detail: row.body,
      actorName: row.actorName,
      actorRole: row.actorRole,
      href: `${basePath}?tab=notes-activity`,
      sourceLabel: 'CRM activity',
    })
  }

  for (const row of visitRows) {
    if (!row.visitedAt) continue
    events.push({
      id: `visit-${row.id}`,
      kind: 'sales_visit',
      at: new Date(row.visitedAt),
      title: 'Sales visit',
      detail: row.notes ?? (row.routeName ? `Route: ${row.routeName}` : null),
      actorName: row.repName,
      actorRole: 'sales_rep',
      href: mode === 'sales' ? `/sales/routes/${row.routeId}` : `/admin/crm/sales-routes/${row.routeId}`,
      sourceLabel: 'Sales route stop',
    })
  }

  return events.sort((a, b) => b.at.getTime() - a.at.getTime())
}
