'use server'

import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  progressionPromotionRecommendations,
  progressionRankAssignments,
  progressionRankRequirements,
  progressionRequirementCompletions,
  progressionReviews,
  progressionStarterKitCompletions,
  progressionStarterKitItems,
  progressionTrainingRecords,
  tastings,
  userNotifications,
  users,
  type ProgressionChangeType,
  type ProgressionRequirementType,
} from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { createUserNotification } from '@/lib/notifications/in-app'
import {
  loadAllAssignmentHistory,
  loadAssignmentHistory,
  loadCurrentAssignments,
  loadOpenRecommendation,
  loadPendingReview,
  loadProgressionDataset,
  loadRequirementCompletions,
  loadRosterMembers,
  loadStarterKitStatus,
  loadAllRankRequirements,
} from '@/lib/progression/data'
import { computeEligibility, computeRequirementProgress, type EligibilitySummary } from '@/lib/progression/eligibility'
import { computeMemberPerformance, type PerformanceSummary } from '@/lib/progression/metrics'
import { canViewMember, getProgressionPermissions, type ProgressionPermissions } from '@/lib/progression/permissions'
import { formatRank, getNextRank, getRank, MAX_LEVEL, MIN_LEVEL, RANKS } from '@/lib/progression/ranks'

const BASE_PATH = '/admin/team-progression'

async function getActingContext() {
  const session = await requireRole('admin', 'staff', 'sales_rep', 'sales_manager', 'taster')
  const roles = session.user.roles ?? [session.user.role as string]
  const current = await loadCurrentAssignments([session.user.id])
  const ownLevel = current.get(session.user.id)?.level ?? null
  const permissions = getProgressionPermissions(roles, ownLevel)
  return { session, roles, ownLevel, permissions }
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

async function hasRecentNotification(userId: string, kind: string, href: string, withinDays = 14) {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), eq(userNotifications.kind, kind), eq(userNotifications.href, href), gte(userNotifications.createdAt, since)))
    .limit(1)
  return rows.length > 0
}

/* ------------------------------------------------------------------- roster */

export type RosterEntry = {
  userId: string
  name: string
  email: string
  role: string
  active: boolean
  avatarUrl: string | null
  homeRegion: string | null
  managerName: string | null
  level: number
  rankName: string
  careerStage: string
  isTemporary: boolean
  lastActivityAt: Date | null
  performance: PerformanceSummary
  nextLevel: number | null
  progressPercent: number | null
  eligibilityStatus: EligibilitySummary['status']
}

export async function getRoster(): Promise<{ entries: RosterEntry[]; permissions: ProgressionPermissions }> {
  const { session, permissions } = await getActingContext()
  const [members, dataset, currentAssignments, allRequirements] = await Promise.all([
    loadRosterMembers(),
    loadProgressionDataset(),
    loadCurrentAssignments(),
    loadAllRankRequirements(),
  ])

  const visibleMembers = permissions.canViewAllMembers
    ? members
    : members.filter(m => canViewMember(permissions, session.user.id, m.id, m.managerUserId))

  const entries: RosterEntry[] = []
  for (const member of visibleMembers) {
    const assignment = currentAssignments.get(member.id)
    const level = assignment?.level ?? MIN_LEVEL
    const rank = getRank(level)
    const perf = computeMemberPerformance(member, dataset)
    const nextRank = getNextRank(level)

    let progressPercent: number | null = null
    let eligibilityStatus: EligibilitySummary['status'] = 'not_yet_eligible'
    if (nextRank) {
      const reqRows = allRequirements.filter(r => r.level === nextRank.level && (!r.market || r.market === member.homeRegion))
      const daysAtLevel = assignment ? daysBetween(assignment.effectiveAt, new Date()) : null
      const progress = computeRequirementProgress(reqRows, perf, daysAtLevel, [])
      const required = progress.filter(r => r.requirementType === 'required')
      progressPercent = required.length > 0 ? Math.round((required.filter(r => r.status === 'complete' || r.status === 'overridden').length / required.length) * 100) : null
      const elig = computeEligibility(progress, false)
      eligibilityStatus = elig.status
    }

    entries.push({
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      active: member.active,
      avatarUrl: member.avatarUrl,
      homeRegion: member.homeRegion,
      managerName: member.managerName,
      level,
      rankName: rank.name,
      careerStage: rank.careerStage,
      isTemporary: assignment?.isTemporary ?? false,
      lastActivityAt: perf.lastActivityAt,
      performance: perf,
      nextLevel: nextRank?.level ?? null,
      progressPercent,
      eligibilityStatus,
    })
  }

  return { entries, permissions }
}

/* -------------------------------------------------------------- dashboard */

export async function getDashboardSummary() {
  const { entries, permissions } = await getRoster()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const rosterIds = entries.map(e => e.userId)

  const byLevel = new Map<number, RosterEntry[]>()
  for (const level of RANKS.map(r => r.level)) byLevel.set(level, [])
  for (const entry of entries) byLevel.get(entry.level)?.push(entry)

  const [overdueReviews, tastingsThisMonthRows, trainingThisMonthRows] = await Promise.all([
    db.select({ id: progressionReviews.id }).from(progressionReviews).where(and(eq(progressionReviews.status, 'scheduled'), lt(progressionReviews.scheduledFor, now))),
    rosterIds.length
      ? db.select({ id: tastings.id }).from(tastings).where(and(inArray(tastings.assignedUserId, rosterIds), eq(tastings.status, 'completed'), gte(tastings.scheduledAt, startOfMonth)))
      : Promise.resolve([]),
    rosterIds.length
      ? db.select({ id: progressionTrainingRecords.id }).from(progressionTrainingRecords).where(and(inArray(progressionTrainingRecords.trainerUserId, rosterIds), gte(progressionTrainingRecords.sessionDate, startOfMonth)))
      : Promise.resolve([]),
  ])

  // Bottles/cases sold this month, scoped to reports submitted (tasting channel) and orders
  // placed (rep-attributed channel) within the current month — same dataset used per-member,
  // just filtered by date here rather than duplicating the roster-wide query.
  const dataset = await loadProgressionDataset()
  let bottlesSoldThisMonth = 0
  let casesSoldThisMonth = 0
  for (const userId of rosterIds) {
    for (const t of dataset.tastingsByUser.get(userId) ?? []) {
      if (t.report && t.report.submittedAt >= startOfMonth) {
        bottlesSoldThisMonth += t.report.bottlesSold ?? 0
        casesSoldThisMonth += t.report.casesSold ?? 0
      }
    }
  }
  for (const orders of dataset.ordersByMemberId.values()) {
    for (const o of orders) {
      if (o.createdAt >= startOfMonth) {
        bottlesSoldThisMonth += o.bottles
        casesSoldThisMonth += o.cases
      }
    }
  }

  const accountsOpenedThisMonth = Array.from(dataset.accountsBySalesMemberId.values())
    .flat()
    .filter(a => a.createdAt >= startOfMonth).length

  return {
    permissions,
    totalActive: entries.filter(e => e.active).length,
    byLevel: Array.from(byLevel.entries()).map(([level, list]) => ({ level, rank: getRank(level), count: list.length })),
    eligibleForPromotion: entries.filter(e => e.eligibilityStatus !== 'not_yet_eligible').length,
    reviewsOverdue: overdueReviews.length,
    tastingsThisMonth: tastingsThisMonthRows.length,
    bottlesSoldThisMonth: Math.round(bottlesSoldThisMonth),
    casesSoldThisMonth: Math.round(casesSoldThisMonth * 100) / 100,
    accountsOpenedThisMonth,
    reordersInfluencedTotal: entries.reduce((sum, e) => sum + e.performance.reordersInfluenced, 0),
    trainingSessionsThisMonth: trainingThisMonthRows.length,
  }
}

/* -------------------------------------------------------------- individual */

export async function getMemberProfile(userId: string) {
  const { session, permissions } = await getActingContext()

  const [members, dataset, currentAssignments, history, manualCompletions, recommendation, pendingReview, allRequirements] = await Promise.all([
    loadRosterMembers(),
    loadProgressionDataset(),
    loadCurrentAssignments(),
    loadAssignmentHistory(userId),
    loadRequirementCompletions(userId),
    loadOpenRecommendation(userId),
    loadPendingReview(userId),
    loadAllRankRequirements(),
  ])

  const member = members.find(m => m.id === userId)
  if (!member) return null

  if (!canViewMember(permissions, session.user.id, userId, member.managerUserId)) {
    return null
  }

  const assignment = currentAssignments.get(userId)
  const level = assignment?.level ?? MIN_LEVEL
  const rank = getRank(level)
  const nextRank = getNextRank(level)
  const performance = computeMemberPerformance(member, dataset)
  const daysAtLevel = assignment ? daysBetween(assignment.effectiveAt, new Date()) : null

  const requirementRows = nextRank ? allRequirements.filter(r => r.level === nextRank.level && (!r.market || r.market === member.homeRegion)) : []
  const requirementProgress = computeRequirementProgress(requirementRows, performance, daysAtLevel, manualCompletions)
  const eligibility = computeEligibility(requirementProgress, recommendation?.status === 'approved')

  const starterKit = await loadStarterKitStatus(userId)

  return {
    member,
    rank,
    nextRank,
    level,
    assignment,
    performance,
    daysAtCurrentLevel: daysAtLevel,
    requirementProgress,
    eligibility,
    history: history.map(h => ({ ...h.a, assignedByName: h.assignedByName })),
    starterKit,
    recommendation,
    pendingReview,
    pendingReviewOverdue: pendingReview ? pendingReview.scheduledFor.getTime() < Date.now() : false,
    permissions,
    isSelf: session.user.id === userId,
  }
}

/* ---------------------------------------------------------------- ranking */

export async function assignRank(input: {
  userId: string
  level: number
  changeType: ProgressionChangeType
  isTemporary?: boolean
  temporaryUntil?: string | null
  reason: string
  notes?: string | null
  overriddenRequirements?: { key: string; reason: string }[]
}) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canAssignRank) throw new Error('Only administrators can change a rank.')
  if (!input.reason?.trim()) throw new Error('A reason is required for every rank change.')
  if (input.level < MIN_LEVEL || input.level > MAX_LEVEL) throw new Error('Invalid rank level.')

  const current = await loadCurrentAssignments([input.userId])
  const previousLevel = current.get(input.userId)?.level ?? null

  await db.insert(progressionRankAssignments).values({
    userId: input.userId,
    level: input.level,
    previousLevel,
    changeType: input.changeType,
    isTemporary: input.isTemporary ?? false,
    temporaryUntil: input.temporaryUntil ? new Date(input.temporaryUntil) : null,
    reason: input.reason.trim(),
    notes: input.notes?.trim() || null,
    overriddenRequirements: input.overriddenRequirements ?? [],
    assignedByUserId: session.user.id,
  })

  // Any open recommendation for this member is resolved by the actual change.
  await db
    .update(progressionPromotionRecommendations)
    .set({ status: 'superseded', decidedByUserId: session.user.id, decidedAt: new Date(), decisionNotes: 'Resolved by a direct rank change.' })
    .where(and(eq(progressionPromotionRecommendations.userId, input.userId), eq(progressionPromotionRecommendations.status, 'recommended')))

  const rank = getRank(input.level)
  const verb = previousLevel == null ? 'assigned to' : input.level > previousLevel ? 'promoted to' : input.level < previousLevel ? 'moved to' : 'reassigned to'
  await createUserNotification({
    userId: input.userId,
    kind: 'progression_rank_changed',
    title: `You've been ${verb} ${formatRank(input.level)}`,
    body: input.reason.trim(),
    href: `/taster/progression`,
  })

  revalidatePath(BASE_PATH)
  revalidatePath(`${BASE_PATH}/roster/${input.userId}`)
  return { success: true, level: input.level, rankName: rank.name }
}

export async function recommendPromotion(input: { userId: string; toLevel: number; reason: string }) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canRecommendPromotion) throw new Error('You are not permitted to recommend a promotion.')
  if (!input.reason?.trim()) throw new Error('A reason is required to recommend a promotion.')

  const current = await loadCurrentAssignments([input.userId])
  const fromLevel = current.get(input.userId)?.level ?? MIN_LEVEL

  const [rec] = await db.insert(progressionPromotionRecommendations).values({
    userId: input.userId,
    fromLevel,
    toLevel: input.toLevel,
    status: 'recommended',
    recommendedByUserId: session.user.id,
    recommendedReason: input.reason.trim(),
  }).returning()

  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'))
  await Promise.all(admins.map(a => createUserNotification({
    userId: a.id,
    kind: 'progression_promotion_recommended',
    title: `Promotion recommended: ${formatRank(input.toLevel)}`,
    body: input.reason.trim(),
    href: `${BASE_PATH}/roster/${input.userId}`,
  })))

  revalidatePath(`${BASE_PATH}/roster/${input.userId}`)
  return rec
}

export async function decideRecommendation(input: { recommendationId: string; decision: 'approved' | 'declined'; reason: string; notes?: string }) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canApprovePromotion) throw new Error('Only administrators can approve a promotion.')

  const [rec] = await db.select().from(progressionPromotionRecommendations).where(eq(progressionPromotionRecommendations.id, input.recommendationId)).limit(1)
  if (!rec || rec.status !== 'recommended') throw new Error('This recommendation is no longer pending.')

  await db.update(progressionPromotionRecommendations).set({
    status: input.decision,
    decidedByUserId: session.user.id,
    decidedAt: new Date(),
    decisionNotes: input.notes?.trim() || null,
  }).where(eq(progressionPromotionRecommendations.id, input.recommendationId))

  if (input.decision === 'approved') {
    await assignRank({
      userId: rec.userId,
      level: rec.toLevel,
      changeType: 'promotion',
      reason: input.reason,
      notes: input.notes ?? null,
    })
  } else {
    await createUserNotification({
      userId: rec.recommendedByUserId,
      kind: 'progression_recommendation_declined',
      title: 'Promotion recommendation declined',
      body: input.notes?.trim() || `The recommendation to promote to ${formatRank(rec.toLevel)} was declined.`,
      href: `${BASE_PATH}/roster/${rec.userId}`,
    })
  }

  revalidatePath(`${BASE_PATH}/roster/${rec.userId}`)
  return { success: true }
}

/* --------------------------------------------------------------- history */

export async function getPromotionHistory() {
  const { permissions } = await getActingContext()
  if (!permissions.canViewAllMembers) throw new Error('Not permitted.')
  const rows = await loadAllAssignmentHistory()
  const userIds = Array.from(new Set(rows.map(r => r.a.userId)))
  const memberUsers = userIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : []
  const nameById = new Map(memberUsers.map(u => [u.id, u.name]))
  return rows.map(r => ({ ...r.a, assignedByName: r.assignedByName, memberName: nameById.get(r.a.userId) ?? 'Unknown' }))
}

/* ------------------------------------------------------------ leaderboard */

export async function getLeaderboard() {
  const { entries, permissions } = await getRoster()
  const dataset = await loadProgressionDataset()
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const mostImproved = entries
    .map(e => {
      const tastings = dataset.tastingsByUser.get(e.userId) ?? []
      const bottlesInRange = (from: Date, to: Date) => tastings
        .filter(t => t.report && t.report.submittedAt >= from && t.report.submittedAt < to)
        .reduce((sum, t) => sum + (t.report?.bottlesSold ?? 0), 0)
      const thisMonth = bottlesInRange(thisMonthStart, now)
      const lastMonth = bottlesInRange(lastMonthStart, thisMonthStart)
      return { entry: e, delta: thisMonth - lastMonth, thisMonth, lastMonth }
    })
    .filter(r => r.thisMonth > 0 || r.lastMonth > 0)
    .sort((a, b) => b.delta - a.delta)

  return { entries, permissions, mostImproved }
}

/* ---------------------------------------------------------------- reviews */

export async function scheduleReview(input: { userId: string; scheduledFor: string; reason?: string }) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canScheduleReview) throw new Error('Not permitted to schedule a review.')

  const [review] = await db.insert(progressionReviews).values({
    userId: input.userId,
    scheduledFor: new Date(input.scheduledFor),
    requestedByUserId: session.user.id,
    reason: input.reason?.trim() || null,
  }).returning()

  await createUserNotification({
    userId: input.userId,
    kind: 'progression_review_scheduled',
    title: 'A rank review has been scheduled',
    body: `Your manager scheduled a rank review for ${new Date(input.scheduledFor).toLocaleDateString()}.`,
    href: '/taster/progression',
  })

  revalidatePath(`${BASE_PATH}/roster/${input.userId}`)
  return review
}

export async function requestReview(reason: string) {
  const { session } = await getActingContext()
  if (!reason?.trim()) throw new Error('Please describe why you are requesting a review.')

  const [review] = await db.insert(progressionReviews).values({
    userId: session.user.id,
    scheduledFor: new Date(),
    requestedByUserId: session.user.id,
    reason: reason.trim(),
  }).returning()

  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'))
  await Promise.all(admins.map(a => createUserNotification({
    userId: a.id,
    kind: 'progression_review_requested',
    title: 'A team member requested a rank review',
    body: reason.trim(),
    href: `${BASE_PATH}/roster/${session.user.id}`,
  })))

  revalidatePath(`${BASE_PATH}/roster/${session.user.id}`)
  return review
}

export async function completeReview(input: { reviewId: string; outcomeNotes?: string }) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canScheduleReview) throw new Error('Not permitted.')

  await db.update(progressionReviews).set({
    status: 'completed',
    completedByUserId: session.user.id,
    completedAt: new Date(),
    outcomeNotes: input.outcomeNotes?.trim() || null,
  }).where(eq(progressionReviews.id, input.reviewId))

  revalidatePath(BASE_PATH)
  return { success: true }
}

/* ------------------------------------------------------------ requirements */

export async function upsertRankRequirement(input: {
  id?: string
  level: number
  market?: string | null
  key: string
  label: string
  requirementType: ProgressionRequirementType
  targetNumeric?: number | null
  isQualitative: boolean
  notes?: string | null
  sortOrder?: number
}) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canConfigureRankRequirements) throw new Error('Only administrators can configure rank requirements.')

  const values = {
    level: input.level,
    market: input.market || null,
    key: input.key,
    label: input.label.trim(),
    requirementType: input.requirementType,
    targetNumeric: input.targetNumeric != null ? String(input.targetNumeric) : null,
    isQualitative: input.isQualitative,
    notes: input.notes?.trim() || null,
    sortOrder: input.sortOrder ?? 0,
    updatedByUserId: session.user.id,
    updatedAt: new Date(),
  }

  if (input.id) {
    await db.update(progressionRankRequirements).set(values).where(eq(progressionRankRequirements.id, input.id))
  } else {
    await db.insert(progressionRankRequirements).values(values).onConflictDoUpdate({
      target: [progressionRankRequirements.level, progressionRankRequirements.market, progressionRankRequirements.key],
      set: values,
    })
  }

  revalidatePath(`${BASE_PATH}/requirements`)
  return { success: true }
}

export async function deleteRankRequirement(id: string) {
  const { permissions } = await getActingContext()
  if (!permissions.canConfigureRankRequirements) throw new Error('Only administrators can configure rank requirements.')
  await db.delete(progressionRankRequirements).where(eq(progressionRankRequirements.id, id))
  revalidatePath(`${BASE_PATH}/requirements`)
  return { success: true }
}

export async function getRequirementsAdmin() {
  const { permissions } = await getActingContext()
  if (!permissions.canConfigureRankRequirements) throw new Error('Not permitted.')
  return loadAllRankRequirements()
}

export async function markRequirementComplete(input: { userId: string; level: number; requirementKey: string; status: 'complete' | 'overridden'; reason?: string }) {
  const { session, permissions } = await getActingContext()
  if (input.status === 'overridden' && !permissions.canOverrideRequirements) throw new Error('Only administrators can override a requirement.')
  if (input.status === 'complete' && !permissions.canMarkRequirementComplete) throw new Error('Not permitted to mark requirements complete.')
  if (input.status === 'overridden' && !input.reason?.trim()) throw new Error('An override requires a documented reason.')

  await db.insert(progressionRequirementCompletions).values({
    userId: input.userId,
    level: input.level,
    requirementKey: input.requirementKey,
    status: input.status,
    reason: input.reason?.trim() || null,
    markedByUserId: session.user.id,
  })

  if (input.status === 'overridden') {
    await createUserNotification({
      userId: input.userId,
      kind: 'progression_requirement_overridden',
      title: 'A requirement was overridden on your progress',
      body: input.reason?.trim() || 'A manager overrode one of your rank requirements.',
      href: '/taster/progression',
    })
  }

  revalidatePath(`${BASE_PATH}/roster/${input.userId}`)
  return { success: true }
}

/* -------------------------------------------------------------- starter kit */

export async function getStarterKitAdmin() {
  const { permissions } = await getActingContext()
  if (!permissions.canConfigureRankRequirements) throw new Error('Not permitted.')
  return db.select().from(progressionStarterKitItems).where(eq(progressionStarterKitItems.isActive, true)).orderBy(progressionStarterKitItems.sortOrder)
}

export async function saveStarterKitItem(input: { id?: string; label: string; description?: string | null; tracksExpiry?: boolean; sortOrder?: number }) {
  const { permissions } = await getActingContext()
  if (!permissions.canConfigureRankRequirements) throw new Error('Only administrators can edit the starter kit.')

  if (input.id) {
    await db.update(progressionStarterKitItems).set({
      label: input.label.trim(),
      description: input.description?.trim() || null,
      tracksExpiry: input.tracksExpiry ?? false,
      sortOrder: input.sortOrder ?? 0,
      updatedAt: new Date(),
    }).where(eq(progressionStarterKitItems.id, input.id))
  } else {
    await db.insert(progressionStarterKitItems).values({
      label: input.label.trim(),
      description: input.description?.trim() || null,
      tracksExpiry: input.tracksExpiry ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
  }

  revalidatePath(`${BASE_PATH}/requirements`)
  return { success: true }
}

export async function removeStarterKitItem(id: string) {
  const { permissions } = await getActingContext()
  if (!permissions.canConfigureRankRequirements) throw new Error('Only administrators can edit the starter kit.')
  await db.update(progressionStarterKitItems).set({ isActive: false }).where(eq(progressionStarterKitItems.id, id))
  revalidatePath(`${BASE_PATH}/requirements`)
  return { success: true }
}

export async function toggleStarterKitCompletion(input: { userId: string; itemId: string; completed: boolean; expiresAt?: string | null }) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canMarkRequirementComplete) throw new Error('Not permitted to update the starter kit.')

  const existing = await db.select().from(progressionStarterKitCompletions).where(and(eq(progressionStarterKitCompletions.userId, input.userId), eq(progressionStarterKitCompletions.itemId, input.itemId))).limit(1)

  if (existing[0]) {
    await db.update(progressionStarterKitCompletions).set({
      completedAt: input.completed ? new Date() : null,
      completedByUserId: input.completed ? session.user.id : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    }).where(eq(progressionStarterKitCompletions.id, existing[0].id))
  } else {
    await db.insert(progressionStarterKitCompletions).values({
      userId: input.userId,
      itemId: input.itemId,
      completedAt: input.completed ? new Date() : null,
      completedByUserId: input.completed ? session.user.id : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    })
  }

  if (input.completed) {
    const status = await loadStarterKitStatus(input.userId)
    if (status.every(s => s.completion?.completedAt)) {
      await createUserNotification({
        userId: input.userId,
        kind: 'progression_starter_kit_complete',
        title: 'Starter kit complete',
        body: 'All starter kit items are complete — nice work.',
        href: '/taster/progression',
      })
    }
  }

  revalidatePath(`${BASE_PATH}/roster/${input.userId}`)
  return { success: true }
}

/* ---------------------------------------------------------------- training */

export async function recordTrainingSession(input: { traineeUserId: string; topic: string; sessionDate: string; notes?: string }) {
  const { session, permissions } = await getActingContext()
  if (!permissions.canRecordTraining) throw new Error('Not permitted to record training sessions.')
  if (!input.topic?.trim()) throw new Error('A training topic is required.')

  const [record] = await db.insert(progressionTrainingRecords).values({
    trainerUserId: session.user.id,
    traineeUserId: input.traineeUserId,
    topic: input.topic.trim(),
    sessionDate: new Date(input.sessionDate),
    notes: input.notes?.trim() || null,
    recordedByUserId: session.user.id,
  }).returning()

  revalidatePath(`${BASE_PATH}/roster/${input.traineeUserId}`)
  revalidatePath(`${BASE_PATH}/roster/${session.user.id}`)
  return record
}

/* --------------------------------------------------------- notification sync */

/** Lightweight, idempotent scan run opportunistically on dashboard load — no cron required. */
export async function syncProgressionNotifications() {
  const { entries } = await getRoster()
  const now = new Date()

  for (const entry of entries) {
    if (entry.eligibilityStatus === 'eligible_for_review') {
      const href = `${BASE_PATH}/roster/${entry.userId}`
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'))
      for (const admin of admins) {
        if (await hasRecentNotification(admin.id, 'progression_eligible_for_review', href)) continue
        await createUserNotification({
          userId: admin.id,
          kind: 'progression_eligible_for_review',
          title: `${entry.name} is eligible for review`,
          body: `${entry.name} has completed the measurable requirements for ${entry.nextLevel ? formatRank(entry.nextLevel) : 'the next rank'}. Manager review is still required.`,
          href,
        })
      }
    }
  }

  const overdue = await db
    .select({ review: progressionReviews, memberName: users.name })
    .from(progressionReviews)
    .innerJoin(users, eq(users.id, progressionReviews.userId))
    .where(and(eq(progressionReviews.status, 'scheduled'), lt(progressionReviews.scheduledFor, now)))

  for (const row of overdue) {
    const href = `${BASE_PATH}/roster/${row.review.userId}`
    if (await hasRecentNotification(row.review.requestedByUserId, 'progression_review_overdue', href)) continue
    await createUserNotification({
      userId: row.review.requestedByUserId,
      kind: 'progression_review_overdue',
      title: `Rank review overdue: ${row.memberName}`,
      body: `The review scheduled for ${row.review.scheduledFor.toLocaleDateString()} is overdue.`,
      href,
    })
  }

  const expiringSoon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const expiring = await db
    .select({ completion: progressionStarterKitCompletions, memberName: users.name })
    .from(progressionStarterKitCompletions)
    .innerJoin(users, eq(users.id, progressionStarterKitCompletions.userId))
    .where(and(isNull(progressionStarterKitCompletions.completedAt), lt(progressionStarterKitCompletions.expiresAt, expiringSoon)))

  for (const row of expiring) {
    if (!row.completion.expiresAt) continue
    const href = `${BASE_PATH}/roster/${row.completion.userId}`
    if (await hasRecentNotification(row.completion.userId, 'progression_certification_expiring', href)) continue
    await createUserNotification({
      userId: row.completion.userId,
      kind: 'progression_certification_expiring',
      title: 'A required certification is expiring',
      body: `Renew before ${row.completion.expiresAt.toLocaleDateString()}.`,
      href: '/taster/progression',
    })
  }
}
