import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '@/db'
import {
  customerAccounts,
  orderItems,
  orders,
  products,
  progressionPromotionRecommendations,
  progressionRankAssignments,
  progressionRankRequirements,
  progressionRequirementCompletions,
  progressionReviews,
  progressionStarterKitCompletions,
  progressionStarterKitItems,
  progressionTrainingRecords,
  salesMembers,
  tastingReports,
  tastings,
  users,
} from '@/db/schema'
import { DEFAULT_REQUIREMENT_TARGETS, DEFAULT_STARTER_KIT_ITEMS, REQUIREMENT_DEFS } from './ranks'

const DEFAULT_BOTTLES_PER_CASE = 12

/* ------------------------------------------------------------- rank requirements */

export type RequirementRow = {
  id: string
  level: number
  market: string | null
  key: string
  label: string
  requirementType: 'required' | 'recommended' | 'optional' | 'not_applicable'
  targetNumeric: number | null
  isQualitative: boolean
  notes: string | null
  sortOrder: number
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/** Loads configured requirements for every level, seeding sensible defaults the first time. */
export async function loadAllRankRequirements(): Promise<RequirementRow[]> {
  const existing = await db.select().from(progressionRankRequirements).orderBy(asc(progressionRankRequirements.level), asc(progressionRankRequirements.sortOrder))
  if (existing.length > 0) {
    return existing.map(r => ({ ...r, targetNumeric: toNumber(r.targetNumeric) }))
  }

  // First use: seed defaults from DEFAULT_REQUIREMENT_TARGETS so the admin has a real,
  // editable starting point instead of an empty screen. This is a one-time lazy insert,
  // mirroring how tasting_economics_settings falls back to defaults on first read.
  const seedRows: (typeof progressionRankRequirements.$inferInsert)[] = []
  for (const [levelStr, targets] of Object.entries(DEFAULT_REQUIREMENT_TARGETS)) {
    const level = Number(levelStr)
    let sortOrder = 0
    for (const def of REQUIREMENT_DEFS) {
      const target = targets?.[def.key]
      if (target === undefined) continue
      seedRows.push({
        level,
        market: null,
        key: def.key,
        label: def.label,
        requirementType: 'required',
        targetNumeric: String(target),
        isQualitative: !def.computed,
        sortOrder: sortOrder++,
      })
    }
  }

  if (seedRows.length === 0) return []
  const inserted = await db.insert(progressionRankRequirements).values(seedRows).onConflictDoNothing().returning()
  return inserted
    .map(r => ({ ...r, targetNumeric: toNumber(r.targetNumeric) }))
    .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
}

export async function getRequirementsForLevel(level: number, market?: string | null): Promise<RequirementRow[]> {
  const all = await loadAllRankRequirements()
  const forLevel = all.filter(r => r.level === level)
  if (!market) return forLevel.filter(r => !r.market)

  // Market-specific rows override the global (market = null) row for the same key.
  const byKey = new Map<string, RequirementRow>()
  for (const r of forLevel.filter(r => !r.market)) byKey.set(r.key, r)
  for (const r of forLevel.filter(r => r.market === market)) byKey.set(r.key, r)
  return Array.from(byKey.values())
}

/* --------------------------------------------------------------- starter kit */

export async function loadStarterKitItems() {
  const existing = await db.select().from(progressionStarterKitItems).where(eq(progressionStarterKitItems.isActive, true)).orderBy(asc(progressionStarterKitItems.sortOrder))
  if (existing.length > 0) return existing

  const seeded = await db.insert(progressionStarterKitItems).values(
    DEFAULT_STARTER_KIT_ITEMS.map((item, i) => ({
      label: item.label,
      description: item.description ?? null,
      tracksExpiry: item.tracksExpiry ?? false,
      sortOrder: i,
    }))
  ).onConflictDoNothing().returning()
  return seeded.sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function loadStarterKitCompletions(userId: string) {
  return db.select().from(progressionStarterKitCompletions).where(eq(progressionStarterKitCompletions.userId, userId))
}

/* --------------------------------------------------------- rank assignments */

export type CurrentAssignment = {
  userId: string
  level: number
  previousLevel: number | null
  changeType: string
  isTemporary: boolean
  temporaryUntil: Date | null
  reason: string
  notes: string | null
  assignedByUserId: string
  assignedByName: string | null
  effectiveAt: Date
}

/** Current rank per user = the latest assignment row (by effectiveAt). No separate "current rank" column to drift. */
export async function loadCurrentAssignments(userIds?: string[]): Promise<Map<string, CurrentAssignment>> {
  const rows = await db
    .select({
      a: progressionRankAssignments,
      assignedByName: users.name,
    })
    .from(progressionRankAssignments)
    .leftJoin(users, eq(users.id, progressionRankAssignments.assignedByUserId))
    .where(userIds && userIds.length > 0 ? inArray(progressionRankAssignments.userId, userIds) : undefined)
    .orderBy(asc(progressionRankAssignments.userId), asc(progressionRankAssignments.effectiveAt))

  const byUser = new Map<string, CurrentAssignment>()
  for (const row of rows) {
    byUser.set(row.a.userId, {
      userId: row.a.userId,
      level: row.a.level,
      previousLevel: row.a.previousLevel,
      changeType: row.a.changeType,
      isTemporary: row.a.isTemporary,
      temporaryUntil: row.a.temporaryUntil,
      reason: row.a.reason,
      notes: row.a.notes,
      assignedByUserId: row.a.assignedByUserId,
      assignedByName: row.assignedByName,
      effectiveAt: row.a.effectiveAt,
    })
  }
  return byUser
}

export async function loadAssignmentHistory(userId: string) {
  return db
    .select({ a: progressionRankAssignments, assignedByName: users.name })
    .from(progressionRankAssignments)
    .leftJoin(users, eq(users.id, progressionRankAssignments.assignedByUserId))
    .where(eq(progressionRankAssignments.userId, userId))
    .orderBy(desc(progressionRankAssignments.effectiveAt))
}

export async function loadAllAssignmentHistory(limit = 200) {
  return db
    .select({ a: progressionRankAssignments, assignedByName: users.name, memberName: users.name })
    .from(progressionRankAssignments)
    .leftJoin(users, eq(users.id, progressionRankAssignments.assignedByUserId))
    .orderBy(desc(progressionRankAssignments.effectiveAt))
    .limit(limit)
}

/* ---------------------------------------------------------------- roster */

const ROSTER_ROLES = ['taster', 'sales_rep', 'sales_manager'] as const

export type RosterMember = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  avatarUrl: string | null
  homeRegion: string | null
  managerId: string | null
  managerUserId: string | null
  managerName: string | null
  salesMemberId: string | null
  createdAt: Date
}

/** Everyone participating in the tasting/sales org — the pool this feature tracks. */
export async function loadRosterMembers(): Promise<RosterMember[]> {
  const rows = await db
    .select({
      user: users,
      member: salesMembers,
    })
    .from(users)
    .leftJoin(salesMembers, eq(salesMembers.userId, users.id))
    .where(inArray(users.role, ROSTER_ROLES))
    .orderBy(asc(users.name))

  const managerIds = Array.from(new Set(rows.map(r => r.member?.managerId).filter((v): v is string => !!v)))
  const managers = managerIds.length
    ? await db.select({ id: salesMembers.id, userId: salesMembers.userId, name: users.name }).from(salesMembers).innerJoin(users, eq(users.id, salesMembers.userId)).where(inArray(salesMembers.id, managerIds))
    : []
  const managerById = new Map(managers.map(m => [m.id, m]))

  return rows.map(r => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    role: r.user.role,
    active: r.user.active,
    avatarUrl: r.user.avatarUrl,
    homeRegion: r.member?.homeRegion ?? null,
    managerId: r.member?.managerId ?? null,
    managerUserId: r.member?.managerId ? managerById.get(r.member.managerId)?.userId ?? null : null,
    managerName: r.member?.managerId ? managerById.get(r.member.managerId)?.name ?? null : null,
    salesMemberId: r.member?.id ?? null,
    createdAt: r.user.createdAt,
  }))
}

/* -------------------------------------------------------- performance dataset */

export type TastingRow = {
  id: string
  assignedUserId: string
  status: string
  scheduledAt: Date
  endAt: Date | null
  report: {
    bottlesSold: number | null
    casesSold: number | null
    actualStartTime: string | null
    actualEndTime: string | null
    submittedAt: Date
  } | null
}

export type PaidOrderRow = {
  id: string
  customerId: string
  createdAt: Date
  relatedTastingId: string | null
  attributedSalesMemberId: string | null
  bottles: number
  cases: number
}

export type ProgressionDataset = {
  tastingsByUser: Map<string, TastingRow[]>
  ordersByTastingId: Map<string, PaidOrderRow[]>
  ordersByMemberId: Map<string, PaidOrderRow[]>
  firstOrderAtByAccount: Map<string, Date>
  accountsBySalesMemberId: Map<string, { id: string; createdAt: Date }[]>
  trainingByTrainer: Map<string, { traineeUserId: string; sessionDate: Date }[]>
}

/** Loads everything progression metrics are derived from, once, so per-member computation is pure/cheap. */
export async function loadProgressionDataset(): Promise<ProgressionDataset> {
  const [tastingRows, orderRows, accountRows, trainingRows] = await Promise.all([
    db
      .select({
        t: tastings,
        r: tastingReports,
      })
      .from(tastings)
      .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id)),
    db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        createdAt: orders.createdAt,
        orderType: orders.orderType,
        status: orders.status,
        relatedTastingId: orders.relatedTastingId,
        attributedSalesMemberId: orders.attributedSalesMemberId,
        quantity: orderItems.quantity,
        unit: orderItems.unit,
        bottlesPerCase: products.bottlesPerCase,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(and(eq(orders.orderType, 'paid'), or(eq(orders.status, 'confirmed'), eq(orders.status, 'fulfilled')))),
    db.select({ id: customerAccounts.id, createdAt: customerAccounts.createdAt, salesMemberId: customerAccounts.assignedSalesRepId }).from(customerAccounts),
    db.select().from(progressionTrainingRecords),
  ])

  const tastingsByUser = new Map<string, TastingRow[]>()
  for (const row of tastingRows) {
    if (!row.t.assignedUserId) continue
    const list = tastingsByUser.get(row.t.assignedUserId) ?? []
    list.push({
      id: row.t.id,
      assignedUserId: row.t.assignedUserId,
      status: row.t.status,
      scheduledAt: row.t.scheduledAt,
      endAt: row.t.endAt,
      report: row.r ? {
        bottlesSold: row.r.bottlesSold,
        casesSold: row.r.casesSold,
        actualStartTime: row.r.actualStartTime,
        actualEndTime: row.r.actualEndTime,
        submittedAt: row.r.submittedAt,
      } : null,
    })
    tastingsByUser.set(row.t.assignedUserId, list)
  }

  // Aggregate order line items into per-order bottle/case totals.
  const perOrder = new Map<string, PaidOrderRow>()
  for (const row of orderRows) {
    const bottlesPerCase = row.bottlesPerCase ?? DEFAULT_BOTTLES_PER_CASE
    const qty = toNumber(row.quantity) ?? 0
    const bottles = row.unit === 'case' ? qty * bottlesPerCase : qty
    const cases = row.unit === 'case' ? qty : qty / bottlesPerCase
    const existing = perOrder.get(row.id)
    if (existing) {
      existing.bottles += bottles
      existing.cases += cases
    } else {
      perOrder.set(row.id, {
        id: row.id,
        customerId: row.customerId,
        createdAt: row.createdAt,
        relatedTastingId: row.relatedTastingId,
        attributedSalesMemberId: row.attributedSalesMemberId,
        bottles,
        cases,
      })
    }
  }

  const allOrders = Array.from(perOrder.values())
  const firstOrderAtByAccount = new Map<string, Date>()
  for (const order of allOrders) {
    const current = firstOrderAtByAccount.get(order.customerId)
    if (!current || order.createdAt < current) firstOrderAtByAccount.set(order.customerId, order.createdAt)
  }

  const ordersByTastingId = new Map<string, PaidOrderRow[]>()
  const ordersByMemberId = new Map<string, PaidOrderRow[]>()
  for (const order of allOrders) {
    if (order.relatedTastingId) {
      const list = ordersByTastingId.get(order.relatedTastingId) ?? []
      list.push(order)
      ordersByTastingId.set(order.relatedTastingId, list)
    }
    if (order.attributedSalesMemberId) {
      const list = ordersByMemberId.get(order.attributedSalesMemberId) ?? []
      list.push(order)
      ordersByMemberId.set(order.attributedSalesMemberId, list)
    }
  }

  const accountsBySalesMemberId = new Map<string, { id: string; createdAt: Date }[]>()
  for (const row of accountRows) {
    if (!row.salesMemberId) continue
    const list = accountsBySalesMemberId.get(row.salesMemberId) ?? []
    list.push({ id: row.id, createdAt: row.createdAt })
    accountsBySalesMemberId.set(row.salesMemberId, list)
  }

  const trainingByTrainer = new Map<string, { traineeUserId: string; sessionDate: Date }[]>()
  for (const row of trainingRows) {
    const list = trainingByTrainer.get(row.trainerUserId) ?? []
    list.push({ traineeUserId: row.traineeUserId, sessionDate: row.sessionDate })
    trainingByTrainer.set(row.trainerUserId, list)
  }

  return { tastingsByUser, ordersByTastingId, ordersByMemberId, firstOrderAtByAccount, accountsBySalesMemberId, trainingByTrainer }
}

/* ---------------------------------------------- manual requirement completions */

export async function loadRequirementCompletions(userId: string) {
  return db.select().from(progressionRequirementCompletions).where(eq(progressionRequirementCompletions.userId, userId)).orderBy(desc(progressionRequirementCompletions.createdAt))
}

export async function loadStarterKitStatus(userId: string) {
  const [items, completions] = await Promise.all([loadStarterKitItems(), loadStarterKitCompletions(userId)])
  const completedByItemId = new Map(completions.map(c => [c.itemId, c]))
  return items.map(item => ({
    item,
    completion: completedByItemId.get(item.id) ?? null,
  }))
}

/* ------------------------------------------------------------- recommendations & reviews */

export async function loadOpenRecommendation(userId: string) {
  const [rec] = await db
    .select()
    .from(progressionPromotionRecommendations)
    .where(and(eq(progressionPromotionRecommendations.userId, userId), eq(progressionPromotionRecommendations.status, 'recommended')))
    .orderBy(desc(progressionPromotionRecommendations.createdAt))
    .limit(1)
  return rec ?? null
}

export async function loadPendingReview(userId: string) {
  const [review] = await db
    .select()
    .from(progressionReviews)
    .where(and(eq(progressionReviews.userId, userId), eq(progressionReviews.status, 'scheduled')))
    .orderBy(desc(progressionReviews.scheduledFor))
    .limit(1)
  return review ?? null
}
