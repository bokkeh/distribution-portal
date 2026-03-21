'use server'

import { and, asc, desc, eq, inArray, isNull, sql, sum } from 'drizzle-orm'
import { db } from '@/db'
import {
  salesMembers,
  salesRegions,
  commissionPlans,
  customerAccounts,
  orders,
  orderItems,
  salesRouteStops,
  commissions,
  users,
} from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { hash } from 'bcryptjs'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SalesMemberWithUser = {
  id: string
  userId: string
  managerId: string | null
  commissionPlanId: string | null
  status: string
  hireDate: string | null
  homeRegion: string | null
  notes: string | null
  onboardingStatus: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    avatarUrl: string | null
    role: string
  }
  manager?: { id: string; user: { name: string } } | null
  commissionPlan?: { id: string; name: string; type: string } | null
  accountCount?: number
  pendingCommissions?: string
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

export async function getSalesMembers(): Promise<SalesMemberWithUser[]> {
  await requireAdminOrStaff()

  const rows = await db
    .select({
      member: salesMembers,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
      },
    })
    .from(salesMembers)
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .orderBy(asc(users.name))

  return rows.map(r => ({ ...r.member, user: r.user }))
}

export async function getSalesMemberById(id: string): Promise<SalesMemberWithUser | null> {
  await requireAdminOrStaff()

  const rows = await db
    .select({
      member: salesMembers,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
      },
    })
    .from(salesMembers)
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .where(eq(salesMembers.id, id))
    .limit(1)

  if (!rows[0]) return null
  return { ...rows[0].member, user: rows[0].user }
}

export async function getSalesRegions() {
  await requireAdminOrStaff()
  return db.select().from(salesRegions).orderBy(asc(salesRegions.name))
}

export async function getCommissionPlans() {
  await requireAdminOrStaff()
  return db.select().from(commissionPlans).orderBy(asc(commissionPlans.name))
}

// ─── Member CRUD ───────────────────────────────────────────────────────────────

export async function createSalesMember(input: {
  name: string
  email: string
  phone?: string
  password?: string
  managerId?: string
  commissionPlanId?: string
  hireDate?: string
  homeRegion?: string
  notes?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireAdminOrStaff()

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
  if (existing[0]) return { success: false, error: 'A user with that email already exists.' }

  const passwordHash = await hash(input.password ?? 'changeme123', 12)

  const [newUser] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      name: input.name,
      phone: input.phone ?? null,
      role: 'sales_rep',
      roles: ['sales_rep'],
    })
    .returning()

  const [newMember] = await db
    .insert(salesMembers)
    .values({
      userId: newUser.id,
      managerId: input.managerId ?? null,
      commissionPlanId: input.commissionPlanId ?? null,
      hireDate: input.hireDate ?? null,
      homeRegion: input.homeRegion ?? null,
      notes: input.notes ?? null,
    })
    .returning()

  return { success: true, id: newMember.id }
}

// Get users that could be promoted to sales members (not yet in salesMembers)
export async function getPromotableUsers() {
  await requireAdminOrStaff()

  const existingMemberUserIds = await db
    .select({ userId: salesMembers.userId })
    .from(salesMembers)

  const excludedIds = existingMemberUserIds.map(r => r.userId)

  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role })
    .from(users)
    .orderBy(asc(users.name))

  return allUsers.filter(u => !excludedIds.includes(u.id))
}

// Promote an existing user (e.g. CRM contact) to a sales member
export async function promoteUserToSalesMember(input: {
  userId: string
  hireDate?: string
  homeRegion?: string
  notes?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireAdminOrStaff()

  // Check they don't already have a salesMembers record
  const existing = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, input.userId)).limit(1)
  if (existing[0]) return { success: false, error: 'This user already has a sales member profile.' }

  // Update their role
  const [existingUser] = await db.select({ roles: users.roles }).from(users).where(eq(users.id, input.userId)).limit(1)
  if (!existingUser) return { success: false, error: 'User not found.' }

  const updatedRoles = Array.from(new Set([...existingUser.roles, 'sales_rep']))
  await db.update(users).set({ role: 'sales_rep', roles: updatedRoles }).where(eq(users.id, input.userId))

  const [newMember] = await db
    .insert(salesMembers)
    .values({
      userId: input.userId,
      hireDate: input.hireDate ?? null,
      homeRegion: input.homeRegion ?? null,
      notes: input.notes ?? null,
    })
    .returning()

  return { success: true, id: newMember.id }
}

export async function updateSalesMember(
  id: string,
  input: {
    managerId?: string | null
    commissionPlanId?: string | null
    status?: 'active' | 'inactive' | 'terminated'
    hireDate?: string | null
    homeRegion?: string | null
    notes?: string | null
    onboardingStatus?: 'pending' | 'in_progress' | 'complete'
  },
): Promise<{ success: boolean; error?: string }> {
  await requireAdminOrStaff()

  await db
    .update(salesMembers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(salesMembers.id, id))

  return { success: true }
}

export async function deleteSalesMember(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdminOrStaff()

  // Unassign all accounts
  await db
    .update(customerAccounts)
    .set({ assignedSalesRepId: null })
    .where(eq(customerAccounts.assignedSalesRepId, id))

  const [member] = await db.select().from(salesMembers).where(eq(salesMembers.id, id)).limit(1)
  if (!member) return { success: false, error: 'Member not found.' }

  // Cascade delete via user FK (cascade set in schema)
  await db.delete(users).where(eq(users.id, member.userId))

  return { success: true }
}

// ─── Account Assignment ────────────────────────────────────────────────────────

export async function assignAccountToRep(
  customerId: string,
  salesRepId: string | null,
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()

  await db
    .update(customerAccounts)
    .set({ assignedSalesRepId: salesRepId })
    .where(eq(customerAccounts.id, customerId))

  return { success: true }
}

export async function assignAccountsToRep(
  customerIds: string[],
  salesRepId: string | null,
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()
  if (!customerIds.length) return { success: true }

  await db
    .update(customerAccounts)
    .set({ assignedSalesRepId: salesRepId })
    .where(inArray(customerAccounts.id, customerIds))

  return { success: true }
}

export async function getAccountsForRep(salesRepId: string) {
  await requireAdminOrStaff()

  return db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, salesRepId))
    .orderBy(asc(customerAccounts.companyName))
}

export async function getAllCustomerAccountsForAssignment() {
  await requireAdminOrStaff()

  return db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      city: customerAccounts.city,
      state: customerAccounts.state,
      businessType: customerAccounts.businessType,
      accountType: customerAccounts.accountType,
      accountPriority: customerAccounts.accountPriority,
      dealStage: customerAccounts.dealStage,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
      assignedRegionId: customerAccounts.assignedRegionId,
      visitFrequency: customerAccounts.visitFrequency,
    })
    .from(customerAccounts)
    .orderBy(asc(customerAccounts.companyName))
}

export async function bulkUpdateAccountAssignment(
  customerIds: string[],
  updates: {
    salesRepId?: string | null
    regionId?: string | null
    visitFrequency?: number | null
    accountPriority?: 'high' | 'medium' | 'low' | null
  },
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()
  if (!customerIds.length) return { success: true }

  await db
    .update(customerAccounts)
    .set({
      ...(('salesRepId' in updates) && { assignedSalesRepId: updates.salesRepId }),
      ...(('regionId' in updates) && { assignedRegionId: updates.regionId }),
      ...(('visitFrequency' in updates) && { visitFrequency: updates.visitFrequency }),
      ...(('accountPriority' in updates) && { accountPriority: updates.accountPriority }),
    })
    .where(inArray(customerAccounts.id, customerIds))

  return { success: true }
}

export async function getUnassignedAccounts() {
  await requireAdminOrStaff()

  return db
    .select()
    .from(customerAccounts)
    .where(isNull(customerAccounts.assignedSalesRepId))
    .orderBy(asc(customerAccounts.companyName))
}

// ─── Regions CRUD ──────────────────────────────────────────────────────────────

export async function createSalesRegion(input: {
  name: string
  description?: string
  assignedManagerId?: string
}): Promise<{ success: boolean; id?: string }> {
  await requireAdminOrStaff()

  const [region] = await db.insert(salesRegions).values(input).returning()
  return { success: true, id: region.id }
}

export async function updateSalesRegion(
  id: string,
  input: { name?: string; description?: string; assignedManagerId?: string | null },
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()

  // Cascade rep change to all accounts in this region
  if ('assignedManagerId' in input) {
    await db
      .update(customerAccounts)
      .set({ assignedSalesRepId: input.assignedManagerId ?? null })
      .where(eq(customerAccounts.assignedRegionId, id))
  }

  await db.update(salesRegions).set(input).where(eq(salesRegions.id, id))
  return { success: true }
}

export async function getRegionAccountStats(regionIds: string[]): Promise<Record<string, number>> {
  await requireAdminOrStaff()
  if (!regionIds.length) return {}

  const rows = await db
    .select({
      regionId: customerAccounts.assignedRegionId,
      count: sql<number>`COUNT(*)`,
    })
    .from(customerAccounts)
    .where(inArray(customerAccounts.assignedRegionId, regionIds))
    .groupBy(customerAccounts.assignedRegionId)

  return Object.fromEntries(rows.map(r => [r.regionId!, Number(r.count)]))
}

export async function assignAccountsToRegion(
  accountIds: string[],
  regionId: string | null,
  repId: string | null,
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()
  if (!accountIds.length) return { success: true }

  await db
    .update(customerAccounts)
    .set({
      assignedRegionId: regionId,
      assignedSalesRepId: repId,
    })
    .where(inArray(customerAccounts.id, accountIds))

  return { success: true }
}

export async function deleteSalesRegion(id: string): Promise<{ success: boolean }> {
  await requireAdminOrStaff()
  // Unassign any accounts in this region
  await db.update(customerAccounts).set({ assignedRegionId: null }).where(eq(customerAccounts.assignedRegionId, id))
  await db.delete(salesRegions).where(eq(salesRegions.id, id))
  return { success: true }
}

// ─── Commission Plans CRUD ─────────────────────────────────────────────────────

export async function createCommissionPlan(input: {
  name: string
  type: string
  ratePerCase?: string
  revenuePercent?: string
  tiers?: Array<{ minCases: number; maxCases: number | null; rate: number }>
}): Promise<{ success: boolean; id?: string }> {
  await requireAdminOrStaff()

  const [plan] = await db
    .insert(commissionPlans)
    .values({
      name: input.name,
      type: input.type as 'flat_case' | 'percent_revenue' | 'tiered',
      ratePerCase: input.ratePerCase ?? null,
      revenuePercent: input.revenuePercent ?? null,
      tiers: input.tiers ?? null,
    })
    .returning()

  return { success: true, id: plan.id }
}

// ─── Commission Calculation ────────────────────────────────────────────────────

export async function calculateCommissionForOrder(orderId: string): Promise<{ amount: number | null }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order?.attributedSalesMemberId) return { amount: null }

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.id, order.attributedSalesMemberId))
    .limit(1)

  if (!member?.commissionPlanId) return { amount: null }

  const [plan] = await db
    .select()
    .from(commissionPlans)
    .where(eq(commissionPlans.id, member.commissionPlanId))
    .limit(1)

  if (!plan) return { amount: null }

  const total = parseFloat(order.total ?? '0')
  let amount = 0

  // Count actual cases from order items
  const [caseSum] = await db
    .select({ total: sum(orderItems.quantity) })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.unit, 'case')))
  const totalCases = parseFloat(caseSum?.total ?? '0')

  if (plan.type === 'percent_revenue') {
    const pct = parseFloat(plan.revenuePercent ?? '0')
    amount = (total * pct) / 100
  } else if (plan.type === 'flat_case') {
    const rate = parseFloat(plan.ratePerCase ?? '0')
    amount = rate * totalCases
  } else if (plan.type === 'tiered' && plan.tiers) {
    const tiers = plan.tiers as Array<{ minCases: number; maxCases: number | null; rate: number }>
    for (const tier of tiers) {
      if (totalCases >= tier.minCases && (tier.maxCases === null || totalCases <= tier.maxCases)) {
        amount = (total * tier.rate) / 100
        break
      }
    }
  }

  return { amount }
}

export async function recordCommission(input: {
  salesMemberId: string
  orderId: string
  amount: number
  notes?: string
}): Promise<{ success: boolean }> {
  await requireAdminOrStaff()

  // Upsert: void existing pending commission for same order if any
  await db
    .update(commissions)
    .set({ status: 'voided' })
    .where(and(eq(commissions.orderId, input.orderId), eq(commissions.status, 'pending')))

  await db.insert(commissions).values({
    salesMemberId: input.salesMemberId,
    orderId: input.orderId,
    amount: String(input.amount),
    notes: input.notes ?? null,
    type: 'order_based',
    isManual: false,
    source: 'system',
  })

  await db
    .update(orders)
    .set({
      commissionStatus: 'pending',
      commissionAmount: String(input.amount),
    })
    .where(eq(orders.id, input.orderId))

  return { success: true }
}

export async function createManualCommission(input: {
  salesMemberId: string
  type: 'manual_bonus' | 'adjustment' | 'spiff' | 'penalty'
  amount: number
  description: string
  notes?: string
  accountId?: string
  orderId?: string
  reasonCode?: string
  effectiveDate?: string
  createdByAdminId: string
}): Promise<{ success: boolean; error?: string }> {
  await requireAdminOrStaff()

  await db.insert(commissions).values({
    salesMemberId: input.salesMemberId,
    orderId: input.orderId ?? null,
    accountId: input.accountId ?? null,
    type: input.type,
    isManual: true,
    source: 'admin_manual',
    description: input.description,
    reasonCode: input.reasonCode ?? null,
    createdByAdminId: input.createdByAdminId,
    amount: String(input.amount),
    notes: input.notes ?? null,
    effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
  })

  return { success: true }
}

export async function voidCommission(
  commissionId: string,
  voidedByUserId: string,
  reason?: string,
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()

  const voidNote = reason ? `[Void reason: ${reason}]` : null
  await db
    .update(commissions)
    .set({
      status: 'voided',
      ...(voidNote && { notes: sql`COALESCE(notes || E'\n', '') || ${voidNote}` }),
    })
    .where(eq(commissions.id, commissionId))

  return { success: true }
}

export async function approveCommission(
  commissionId: string,
  approvedByUserId: string,
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()

  await db
    .update(commissions)
    .set({ status: 'approved', approvedByUserId, approvedAt: new Date() })
    .where(eq(commissions.id, commissionId))

  return { success: true }
}

export async function getCommissionsForMember(salesMemberId: string) {
  await requireAdminOrStaff()

  return db
    .select()
    .from(commissions)
    .where(eq(commissions.salesMemberId, salesMemberId))
    .orderBy(desc(commissions.createdAt))
}

export async function getAllPendingCommissions() {
  await requireAdminOrStaff()

  const rows = await db
    .select({
      commission: commissions,
      member: salesMembers,
      user: { id: users.id, name: users.name, email: users.email },
      order: { id: orders.id, total: orders.total, createdAt: orders.createdAt },
    })
    .from(commissions)
    .innerJoin(salesMembers, eq(commissions.salesMemberId, salesMembers.id))
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .leftJoin(orders, eq(commissions.orderId, orders.id))
    .where(eq(commissions.status, 'pending'))
    .orderBy(desc(commissions.createdAt))

  return rows
}

export async function getAllCommissions() {
  await requireAdminOrStaff()

  const rows = await db
    .select({
      commission: commissions,
      member: salesMembers,
      user: { id: users.id, name: users.name, email: users.email },
      order: { id: orders.id, total: orders.total, createdAt: orders.createdAt },
    })
    .from(commissions)
    .innerJoin(salesMembers, eq(commissions.salesMemberId, salesMembers.id))
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .leftJoin(orders, eq(commissions.orderId, orders.id))
    .orderBy(desc(commissions.createdAt))

  return rows
}

export async function markCommissionPaid(
  commissionId: string,
  paidByUserId: string,
): Promise<{ success: boolean }> {
  await requireAdminOrStaff()

  await db
    .update(commissions)
    .set({ status: 'paid', paidAt: new Date() })
    .where(eq(commissions.id, commissionId))

  return { success: true }
}

// ─── Visit Tracking ────────────────────────────────────────────────────────────

export async function logVisit(customerId: string, salesMemberId: string): Promise<{ success: boolean }> {
  const now = new Date()

  const [account] = await db
    .select({ visitFrequency: customerAccounts.visitFrequency, assignedSalesRepId: customerAccounts.assignedSalesRepId })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customerId))
    .limit(1)

  if (!account || account.assignedSalesRepId !== salesMemberId) {
    return { success: false }
  }

  const frequencyDays = account.visitFrequency ?? 30
  const nextVisit = new Date(now)
  nextVisit.setDate(nextVisit.getDate() + frequencyDays)

  await db
    .update(customerAccounts)
    .set({ lastVisitDate: now, nextRequiredVisitDate: nextVisit })
    .where(eq(customerAccounts.id, customerId))

  return { success: true }
}

export async function checkInRouteStop(stopId: string): Promise<{ success: boolean }> {
  await db
    .update(salesRouteStops)
    .set({ visitedAt: new Date() })
    .where(eq(salesRouteStops.id, stopId))

  return { success: true }
}
