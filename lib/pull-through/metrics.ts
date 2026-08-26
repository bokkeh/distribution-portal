/**
 * Pull-Through metric calculators.
 *
 * These are pure functions over records already stored in the portal. They hold no
 * state and write nothing back — every number is recomputed from source on read, so
 * a corrected order, tasting or inventory check is reflected immediately everywhere.
 */

import type {
  AccountTemperature,
  DataQualityFlag,
  InventoryPosition,
  OrderMetrics,
  PullThroughOrder,
  PullThroughScore,
  PullThroughTasting,
  RecommendedAction,
  ScoreComponent,
  SourceRef,
  TastingMetrics,
} from './types'

export const DAY_MS = 86_400_000

/** An inventory reading older than this is treated as stale and flagged. */
export const INVENTORY_STALE_DAYS = 21
/** Below this many days of stock we consider the account low. */
export const LOW_DAYS_OF_INVENTORY = 10
/** Tasting follow-up window before we nudge the rep. */
export const TASTING_FOLLOW_UP_DAYS = 3
/** Minimum weight of scoreable signal before we publish a score at all. */
export const MIN_SCORE_WEIGHT = 40

export function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function mean(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: number[]) {
  if (values.length < 2) return null
  const avg = mean(values)
  if (avg == null) return null
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function reorderFrequencyLabel(avgDays: number | null) {
  if (avgDays == null || avgDays <= 0) return null
  if (avgDays <= 10) return 'Weekly'
  if (avgDays <= 18) return 'Biweekly'
  if (avgDays <= 45) return 'Monthly'
  if (avgDays <= 100) return 'Quarterly'
  return 'Infrequent'
}

/* ------------------------------------------------------------------ orders */

/**
 * Derives every order/reorder metric from the account's real order history.
 *
 * `commercialOrders` must be non-cancelled `paid` orders sorted oldest-first. Sample
 * drops are counted separately: they are not a purchase and would distort cadence.
 */
export function computeOrderMetrics(
  commercialOrders: PullThroughOrder[],
  sampleOrderCount: number,
  now: Date,
): OrderMetrics {
  const empty: OrderMetrics = {
    totalOrders: 0,
    totalCases: 0,
    totalBottles: 0,
    reorderCount: 0,
    firstOrderAt: null,
    firstOrderBottles: null,
    firstOrderCases: null,
    lastOrderAt: null,
    lastOrderBottles: null,
    lastOrderCases: null,
    previousOrderAt: null,
    previousOrderBottles: null,
    avgOrderBottles: null,
    avgDaysBetweenOrders: null,
    orderGapStdDevDays: null,
    daysSinceLastOrder: null,
    firstToFirstReorderDays: null,
    predictedNextOrderFrom: null,
    predictedNextOrderTo: null,
    reorderFrequencyLabel: null,
    bottlesPerDay: null,
    hasNeverReordered: true,
    sampleOrderCount,
  }

  if (commercialOrders.length === 0) return empty

  const first = commercialOrders[0]
  const last = commercialOrders[commercialOrders.length - 1]
  const previous = commercialOrders.length >= 2 ? commercialOrders[commercialOrders.length - 2] : null

  const totalBottles = commercialOrders.reduce((sum, order) => sum + order.bottles, 0)
  const totalCases = commercialOrders.reduce((sum, order) => sum + order.cases, 0)

  const gaps: number[] = []
  for (let i = 1; i < commercialOrders.length; i += 1) {
    gaps.push(daysBetween(commercialOrders[i - 1].orderedAt, commercialOrders[i].orderedAt))
  }

  const avgDaysBetweenOrders = mean(gaps)
  const gapStdDev = stdDev(gaps)

  // Consumption rate. With a single order we cannot separate "still on the shelf"
  // from "sold through", so we decline to guess.
  let bottlesPerDay: number | null = null
  if (commercialOrders.length >= 2 && avgDaysBetweenOrders != null && avgDaysBetweenOrders > 0) {
    const span = daysBetween(first.orderedAt, last.orderedAt) + avgDaysBetweenOrders
    if (span > 0) bottlesPerDay = totalBottles / span
  }

  let predictedFrom: Date | null = null
  let predictedTo: Date | null = null
  if (avgDaysBetweenOrders != null && avgDaysBetweenOrders > 0) {
    const window = clamp(Math.round(gapStdDev ?? avgDaysBetweenOrders * 0.2), 2, 10)
    predictedFrom = addDays(last.orderedAt, Math.max(1, Math.round(avgDaysBetweenOrders) - window))
    predictedTo = addDays(last.orderedAt, Math.round(avgDaysBetweenOrders) + window)
  }

  return {
    totalOrders: commercialOrders.length,
    totalCases,
    totalBottles,
    reorderCount: commercialOrders.length - 1,
    firstOrderAt: first.orderedAt,
    firstOrderBottles: first.bottles,
    firstOrderCases: first.cases,
    lastOrderAt: last.orderedAt,
    lastOrderBottles: last.bottles,
    lastOrderCases: last.cases,
    previousOrderAt: previous?.orderedAt ?? null,
    previousOrderBottles: previous?.bottles ?? null,
    avgOrderBottles: totalBottles / commercialOrders.length,
    avgDaysBetweenOrders,
    orderGapStdDevDays: gapStdDev,
    daysSinceLastOrder: daysBetween(last.orderedAt, now),
    firstToFirstReorderDays: gaps.length > 0 ? gaps[0] : null,
    predictedNextOrderFrom: predictedFrom,
    predictedNextOrderTo: predictedTo,
    reorderFrequencyLabel: reorderFrequencyLabel(avgDaysBetweenOrders),
    bottlesPerDay,
    hasNeverReordered: commercialOrders.length < 2,
    sampleOrderCount,
  }
}

/* --------------------------------------------------------------- inventory */

export type ConfirmedInventoryInput = {
  bottles: number
  cases: number
  productCount: number
  lastConfirmedAt: Date | null
  lastConfirmedByName: string | null
  lastConfirmedByRole: string | null
  source: SourceRef | null
}

/**
 * Resolves the account's inventory position with explicit provenance.
 *
 * A reading is only ever labelled `confirmed` when it is the physically checked
 * number with nothing modelled on top of it. The moment we add received stock or
 * subtract modelled depletion, it becomes `estimated`.
 */
export function computeInventoryPosition(
  confirmed: ConfirmedInventoryInput | null,
  bottlesReceivedSinceCheck: number,
  bottlesPerDay: number | null,
  bottlesPerCase: number,
  now: Date,
): InventoryPosition {
  if (!confirmed || confirmed.lastConfirmedAt == null) {
    return {
      confidence: 'unknown',
      bottles: null,
      cases: null,
      confirmedBottles: null,
      confirmedCases: null,
      lastConfirmedAt: null,
      lastConfirmedByName: null,
      lastConfirmedByRole: null,
      daysSinceConfirmed: null,
      bottlesReceivedSinceCheck,
      bottlesDepletedSinceCheck: null,
      estimatedDaysOfInventory: null,
      productCount: confirmed?.productCount ?? 0,
      source: null,
      explanation: 'No inventory check has ever been recorded for this account.',
    }
  }

  const daysSinceConfirmed = daysBetween(confirmed.lastConfirmedAt, now)
  const depleted =
    bottlesPerDay != null && daysSinceConfirmed > 0 ? bottlesPerDay * daysSinceConfirmed : null

  const isAdjusted = bottlesReceivedSinceCheck > 0 || (depleted != null && depleted > 0)

  const bottles = isAdjusted
    ? Math.max(0, confirmed.bottles + bottlesReceivedSinceCheck - (depleted ?? 0))
    : confirmed.bottles

  const cases = bottlesPerCase > 0 ? bottles / bottlesPerCase : confirmed.cases

  const estimatedDaysOfInventory =
    bottlesPerDay != null && bottlesPerDay > 0 ? bottles / bottlesPerDay : null

  let explanation: string
  if (!isAdjusted) {
    explanation = `Physically confirmed count, unchanged since the check${
      daysSinceConfirmed > 0 ? ` ${daysSinceConfirmed} day${daysSinceConfirmed === 1 ? '' : 's'} ago` : ''
    }.`
  } else {
    const parts = [`${confirmed.bottles.toFixed(0)} bottles confirmed`]
    if (bottlesReceivedSinceCheck > 0) parts.push(`+${bottlesReceivedSinceCheck.toFixed(0)} delivered since`)
    if (depleted != null && depleted > 0) parts.push(`−${depleted.toFixed(0)} modelled sell-through`)
    explanation = `${parts.join(' ')} over ${daysSinceConfirmed} day${daysSinceConfirmed === 1 ? '' : 's'}.`
  }

  return {
    confidence: isAdjusted ? 'estimated' : 'confirmed',
    bottles,
    cases,
    confirmedBottles: confirmed.bottles,
    confirmedCases: confirmed.cases,
    lastConfirmedAt: confirmed.lastConfirmedAt,
    lastConfirmedByName: confirmed.lastConfirmedByName,
    lastConfirmedByRole: confirmed.lastConfirmedByRole,
    daysSinceConfirmed,
    bottlesReceivedSinceCheck,
    bottlesDepletedSinceCheck: depleted,
    estimatedDaysOfInventory,
    productCount: confirmed.productCount,
    source: confirmed.source,
    explanation,
  }
}

/* ---------------------------------------------------------------- tastings */

/**
 * Attaches the next commercial order after each tasting.
 *
 * This is correlation only. The UI must present it as "reorder following tasting",
 * never as a reorder caused by the tasting.
 */
export function attachTastingOrderAttribution(
  tastings: PullThroughTasting[],
  commercialOrders: PullThroughOrder[],
): PullThroughTasting[] {
  return tastings.map((tasting) => {
    const nextOrder = commercialOrders.find(
      (order) => order.orderedAt.getTime() > tasting.occurredAt.getTime(),
    )

    if (!nextOrder) {
      return {
        ...tasting,
        nextOrderId: null,
        nextOrderAt: null,
        nextOrderBottles: null,
        nextOrderCases: null,
        daysToNextOrder: null,
        within7: false,
        within14: false,
        within30: false,
      }
    }

    const days = daysBetween(tasting.occurredAt, nextOrder.orderedAt)

    return {
      ...tasting,
      nextOrderId: nextOrder.id,
      nextOrderAt: nextOrder.orderedAt,
      nextOrderBottles: nextOrder.bottles,
      nextOrderCases: nextOrder.cases,
      daysToNextOrder: days,
      within7: days <= 7,
      within14: days <= 14,
      within30: days <= 30,
    }
  })
}

export function computeTastingMetrics(
  tastings: PullThroughTasting[],
  commercialOrders: PullThroughOrder[],
): TastingMetrics {
  const completed = tastings.filter((tasting) => tasting.status === 'completed')
  const reported = tastings.filter((tasting) => tasting.hasReport)
  const withSales = tastings.filter((tasting) => tasting.bottlesSold != null)
  const last = tastings.length > 0 ? tastings[tastings.length - 1] : null

  const totalBottlesSold = withSales.reduce((sum, tasting) => sum + (tasting.bottlesSold ?? 0), 0)
  const daysToOrder = tastings
    .map((tasting) => tasting.daysToNextOrder)
    .filter((value): value is number => value != null)

  // Cadence before vs after the first tasting — a correlation signal for tasting lift.
  const firstTasting = tastings[0] ?? null
  let cadenceBefore: number | null = null
  let cadenceAfter: number | null = null

  if (firstTasting) {
    const before = commercialOrders.filter(
      (order) => order.orderedAt.getTime() <= firstTasting.occurredAt.getTime(),
    )
    const after = commercialOrders.filter(
      (order) => order.orderedAt.getTime() > firstTasting.occurredAt.getTime(),
    )

    if (before.length >= 2) {
      const gaps: number[] = []
      for (let i = 1; i < before.length; i += 1) {
        gaps.push(daysBetween(before[i - 1].orderedAt, before[i].orderedAt))
      }
      cadenceBefore = mean(gaps)
    }

    // The gap spanning the tasting counts toward the "after" cadence.
    const spanning = before.length > 0 && after.length > 0 ? [before[before.length - 1], ...after] : after
    if (spanning.length >= 2) {
      const gaps: number[] = []
      for (let i = 1; i < spanning.length; i += 1) {
        gaps.push(daysBetween(spanning[i - 1].orderedAt, spanning[i].orderedAt))
      }
      cadenceAfter = mean(gaps)
    }
  }

  return {
    tastingCount: tastings.length,
    completedCount: completed.length,
    reportedCount: reported.length,
    lastTastingAt: last?.occurredAt ?? null,
    lastTastingId: last?.id ?? null,
    lastTasterName: last?.tasterName ?? null,
    lastTastingBottlesSold: last?.bottlesSold ?? null,
    lastTastingNextOrderAt: last?.nextOrderAt ?? null,
    lastTastingDaysToReorder: last?.daysToNextOrder ?? null,
    totalBottlesSoldAtTastings: totalBottlesSold,
    avgBottlesSoldPerTasting: withSales.length > 0 ? totalBottlesSold / withSales.length : null,
    followedBy7: tastings.filter((tasting) => tasting.within7).length,
    followedBy14: tastings.filter((tasting) => tasting.within14).length,
    followedBy30: tastings.filter((tasting) => tasting.within30).length,
    avgDaysToFollowingOrder: mean(daysToOrder),
    hasEverHadTasting: tastings.length > 0,
    cadenceBeforeFirstTasting: cadenceBefore,
    cadenceAfterFirstTasting: cadenceAfter,
  }
}

/* ------------------------------------------------------------- temperature */

export function deriveTemperature(
  orders: OrderMetrics,
  inventory: InventoryPosition,
  tastings: TastingMetrics,
): { temperature: AccountTemperature; why: string[] } {
  const why: string[] = []
  const { totalOrders, avgDaysBetweenOrders, daysSinceLastOrder, reorderCount } = orders

  if (totalOrders === 0) {
    return { temperature: 'new', why: ['No commercial orders on record yet'] }
  }

  if (totalOrders < 2 || avgDaysBetweenOrders == null) {
    why.push(`Only ${totalOrders} order on record — no reorder pattern established yet`)
    if (daysSinceLastOrder != null) why.push(`${daysSinceLastOrder} days since that order`)
    return { temperature: 'new', why }
  }

  // Every order landed on the same day (split POs, or a backfilled import). There is
  // an order count but no interval, so there is no cadence to measure against.
  if (avgDaysBetweenOrders <= 0) {
    why.push(`${totalOrders} orders all recorded on the same day — no interval to measure`)
    if (daysSinceLastOrder != null) why.push(`${daysSinceLastOrder} days since that order`)
    why.push('A second order on a later date will establish the reorder pattern')
    return { temperature: 'new', why }
  }

  const ratio = daysSinceLastOrder != null ? daysSinceLastOrder / avgDaysBetweenOrders : null
  const cadence = `Averages a reorder every ${Math.round(avgDaysBetweenOrders)} days`

  if (ratio != null && ratio >= 2) {
    why.push(cadence)
    why.push(`${daysSinceLastOrder} days since last order — ${ratio.toFixed(1)}× the normal interval`)
    why.push(`${reorderCount} prior reorder${reorderCount === 1 ? '' : 's'}, so this is a break in an established pattern`)
    return { temperature: 'at_risk', why }
  }

  if (ratio != null && ratio <= 0.9 && reorderCount >= 2) {
    why.push(cadence)
    why.push(`${daysSinceLastOrder} days since last order — inside the normal window`)
    why.push(`${reorderCount} reorders on record`)
    if (tastings.followedBy30 > 0) {
      why.push(`${tastings.followedBy30} tasting${tastings.followedBy30 === 1 ? '' : 's'} followed by an order within 30 days`)
    }
    if (inventory.estimatedDaysOfInventory != null && inventory.estimatedDaysOfInventory < avgDaysBetweenOrders) {
      why.push(`Stock is moving — roughly ${Math.round(inventory.estimatedDaysOfInventory)} days of inventory left`)
    }
    return { temperature: 'hot', why }
  }

  if (ratio != null && ratio <= 1.25) {
    why.push(cadence)
    why.push(`${daysSinceLastOrder} days since last order — near the expected reorder point`)
    return { temperature: 'warm', why }
  }

  why.push(cadence)
  why.push(`${daysSinceLastOrder} days since last order — past the expected reorder window`)
  return { temperature: 'cold', why }
}

/* ------------------------------------------------------------------- score */

export function computePullThroughScore(
  orders: OrderMetrics,
  inventory: InventoryPosition,
  tastings: TastingMetrics,
  recentBottles: { last90: number; prior90: number },
  accountAgeDays: number,
): PullThroughScore {
  const components: ScoreComponent[] = []

  if (orders.totalOrders >= 2 && orders.avgDaysBetweenOrders != null && orders.avgDaysBetweenOrders > 0) {
    const depth = clamp(orders.reorderCount / 4, 0, 1)
    const regularity =
      orders.orderGapStdDevDays != null && orders.avgDaysBetweenOrders > 0
        ? clamp(1 - orders.orderGapStdDevDays / orders.avgDaysBetweenOrders, 0, 1)
        : 0.5
    components.push({
      key: 'reorder_consistency',
      label: 'Reorder consistency',
      value: 0.6 * depth + 0.4 * regularity,
      weight: 30,
      detail: `${orders.reorderCount} reorder${orders.reorderCount === 1 ? '' : 's'}, every ${Math.round(orders.avgDaysBetweenOrders)} days on average`,
    })
  }

  if (orders.avgDaysBetweenOrders != null && orders.daysSinceLastOrder != null && orders.avgDaysBetweenOrders > 0) {
    const ratio = orders.daysSinceLastOrder / orders.avgDaysBetweenOrders
    components.push({
      key: 'recency',
      label: 'Recency vs cadence',
      value: ratio <= 1 ? 1 : clamp(1 - (ratio - 1) / 1.5, 0, 1),
      weight: 30,
      detail: `${orders.daysSinceLastOrder} days since last order against a ${Math.round(orders.avgDaysBetweenOrders)}-day cycle`,
    })
  }

  if (accountAgeDays >= 120 && orders.totalOrders >= 2) {
    const { last90, prior90 } = recentBottles
    if (prior90 > 0) {
      components.push({
        key: 'volume_trend',
        label: 'Volume trend',
        value: clamp(0.5 * (last90 / prior90), 0, 1),
        weight: 20,
        detail: `${last90.toFixed(0)} bottles in the last 90 days vs ${prior90.toFixed(0)} in the prior 90`,
      })
    } else if (last90 > 0) {
      components.push({
        key: 'volume_trend',
        label: 'Volume trend',
        value: 0.75,
        weight: 20,
        detail: `${last90.toFixed(0)} bottles in the last 90 days after a quiet prior quarter`,
      })
    }
  }

  if (
    inventory.estimatedDaysOfInventory != null &&
    orders.avgDaysBetweenOrders != null &&
    orders.avgDaysBetweenOrders > 0
  ) {
    components.push({
      key: 'sell_through',
      label: 'Sell-through',
      value: clamp(1 - inventory.estimatedDaysOfInventory / (orders.avgDaysBetweenOrders * 2), 0, 1),
      weight: 10,
      detail: `About ${Math.round(inventory.estimatedDaysOfInventory)} days of stock on hand`,
    })
  }

  if (tastings.reportedCount > 0) {
    components.push({
      key: 'tasting_conversion',
      label: 'Tasting conversion',
      value: clamp(tastings.followedBy30 / tastings.reportedCount, 0, 1),
      weight: 10,
      detail: `${tastings.followedBy30} of ${tastings.reportedCount} tastings followed by an order within 30 days`,
    })
  }

  const evaluatedWeight = components.reduce((sum, component) => sum + component.weight, 0)

  if (evaluatedWeight < MIN_SCORE_WEIGHT) {
    return {
      score: null,
      components,
      evaluatedWeight,
      reason: 'Not enough data — at least two orders are needed before this account can be scored.',
    }
  }

  const weighted = components.reduce((sum, component) => sum + component.value * component.weight, 0)

  return {
    score: Math.round((weighted / evaluatedWeight) * 100),
    components,
    evaluatedWeight,
    reason: `Weighted across ${components.length} signal${components.length === 1 ? '' : 's'} covering ${evaluatedWeight} of 100 possible points.`,
  }
}

/* --------------------------------------------------------- recommendations */

export function recommendAction(
  orders: OrderMetrics,
  inventory: InventoryPosition,
  tastings: TastingMetrics,
  temperature: AccountTemperature,
  now: Date,
): RecommendedAction {
  const why: string[] = []

  const lowStock =
    inventory.bottles != null &&
    ((inventory.estimatedDaysOfInventory != null && inventory.estimatedDaysOfInventory <= LOW_DAYS_OF_INVENTORY) ||
      inventory.bottles <= 6)

  const dueForReorder =
    orders.avgDaysBetweenOrders != null &&
    orders.avgDaysBetweenOrders > 0 &&
    orders.daysSinceLastOrder != null &&
    orders.daysSinceLastOrder >= orders.avgDaysBetweenOrders * 0.85

  // 1. An open tasting with no order behind it yet is the most perishable opportunity.
  if (
    tastings.lastTastingAt != null &&
    tastings.lastTastingNextOrderAt == null &&
    daysBetween(tastings.lastTastingAt, now) >= TASTING_FOLLOW_UP_DAYS &&
    daysBetween(tastings.lastTastingAt, now) <= 30
  ) {
    const days = daysBetween(tastings.lastTastingAt, now)
    why.push(`Tasting held ${days} days ago${tastings.lastTasterName ? ` by ${tastings.lastTasterName}` : ''}`)
    if (tastings.lastTastingBottlesSold != null) {
      why.push(`${tastings.lastTastingBottlesSold} bottles sold during the tasting`)
    }
    why.push('No order placed since')
    return { key: 'follow_up_after_tasting', label: 'FOLLOW UP AFTER TASTING', urgency: 'high', why }
  }

  // 2. An established account that has gone quiet well past its own pattern.
  if (temperature === 'at_risk') {
    why.push(`Normally reorders every ${Math.round(orders.avgDaysBetweenOrders ?? 0)} days`)
    why.push(`Now at day ${orders.daysSinceLastOrder}`)
    why.push(`${orders.reorderCount} prior reorder${orders.reorderCount === 1 ? '' : 's'} — this is a break in pattern`)
    return { key: 'win_back', label: 'WIN BACK — AT RISK', urgency: 'high', why }
  }

  // 3. Low stock plus a due reorder is the classic call.
  if (lowStock && dueForReorder) {
    if (inventory.bottles != null) {
      why.push(
        `${inventory.bottles.toFixed(0)} bottles ${inventory.confidence === 'confirmed' ? 'confirmed' : 'estimated'} remaining`,
      )
    }
    if (orders.avgDaysBetweenOrders != null) why.push(`Average reorder interval: ${Math.round(orders.avgDaysBetweenOrders)} days`)
    if (orders.daysSinceLastOrder != null) why.push(`${orders.daysSinceLastOrder} days since last order`)
    const urgency = temperature === 'hot' ? 'high' : 'medium'
    return {
      key: temperature === 'hot' ? 'high_priority' : 'call_for_reorder',
      label: temperature === 'hot' ? 'HIGH PRIORITY — STRONG ACCOUNT, LOW STOCK' : 'CALL FOR REORDER',
      urgency,
      why,
    }
  }

  if (lowStock) {
    if (inventory.bottles != null) why.push(`${inventory.bottles.toFixed(0)} bottles remaining`)
    if (inventory.estimatedDaysOfInventory != null) {
      why.push(`About ${Math.round(inventory.estimatedDaysOfInventory)} days of stock left at the current rate`)
    }
    return { key: 'call_for_reorder', label: 'CALL FOR REORDER', urgency: 'medium', why }
  }

  // 4. Overdue against their own cadence.
  if (
    orders.avgDaysBetweenOrders != null &&
    orders.avgDaysBetweenOrders > 0 &&
    orders.daysSinceLastOrder != null &&
    orders.daysSinceLastOrder > orders.avgDaysBetweenOrders * 1.25
  ) {
    why.push(`Account normally reorders every ${Math.round(orders.avgDaysBetweenOrders)} days`)
    why.push(`Now at day ${orders.daysSinceLastOrder}`)
    return { key: 'sales_visit', label: 'SALES VISIT', urgency: 'medium', why }
  }

  // 5. Never reordered after an initial order.
  if (orders.totalOrders === 1 && orders.daysSinceLastOrder != null && orders.daysSinceLastOrder >= 30) {
    why.push(`Placed one order ${orders.daysSinceLastOrder} days ago and has not reordered`)
    if (orders.firstOrderBottles != null) why.push(`Initial order was ${orders.firstOrderBottles} bottles`)
    if (!tastings.hasEverHadTasting) why.push('No tasting has ever been run here')
    return { key: 'first_reorder_push', label: 'PUSH FOR FIRST REORDER', urgency: 'high', why }
  }

  // 6. We are flying blind on stock.
  if (
    inventory.confidence === 'unknown' ||
    (inventory.daysSinceConfirmed != null && inventory.daysSinceConfirmed > INVENTORY_STALE_DAYS)
  ) {
    if (inventory.confidence === 'unknown') {
      why.push('No inventory check has ever been recorded')
    } else {
      why.push(`Last confirmed inventory was ${inventory.daysSinceConfirmed} days ago`)
    }
    if (orders.totalOrders > 0) why.push(`${orders.totalOrders} orders on record, so the account is active`)
    return { key: 'inventory_check_needed', label: 'INVENTORY CHECK NEEDED', urgency: 'medium', why }
  }

  // 7. Stock sitting still and no tasting ever run.
  if (
    !tastings.hasEverHadTasting &&
    inventory.bottles != null &&
    inventory.bottles > 0 &&
    orders.avgDaysBetweenOrders != null &&
    orders.avgDaysBetweenOrders > 0 &&
    inventory.estimatedDaysOfInventory != null &&
    inventory.estimatedDaysOfInventory > orders.avgDaysBetweenOrders
  ) {
    why.push(`${inventory.bottles.toFixed(0)} bottles on hand but slow sell-through`)
    why.push('No tasting has ever been run at this account')
    return { key: 'book_tasting', label: 'BOOK TASTING', urgency: 'medium', why }
  }

  if (temperature === 'new') {
    why.push('Not enough order history to establish a pattern yet')
    if (!tastings.hasEverHadTasting) why.push('No tasting on record — a tasting would build early momentum')
    return { key: 'book_tasting', label: 'BOOK TASTING', urgency: 'low', why }
  }

  why.push('Ordering on pattern with stock on hand')
  if (orders.daysSinceLastOrder != null && orders.avgDaysBetweenOrders != null && orders.avgDaysBetweenOrders > 0) {
    why.push(`Day ${orders.daysSinceLastOrder} of a ${Math.round(orders.avgDaysBetweenOrders)}-day cycle`)
  }
  return { key: 'no_action', label: 'NO ACTION', urgency: 'none', why }
}

/* ------------------------------------------------------------ data quality */

export function collectDataQualityFlags(
  orders: OrderMetrics,
  inventory: InventoryPosition,
  tastings: PullThroughTasting[],
  context: { contactCount: number; hasSalesRep: boolean; accountHref: string; contactsHref: string },
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = []

  if (inventory.confidence === 'unknown') {
    flags.push({
      key: 'inventory_unknown',
      label: 'Inventory unknown',
      severity: orders.totalOrders > 0 ? 'high' : 'medium',
      href: `${context.accountHref}?tab=inventory`,
      hint: 'No inventory check has ever been recorded for this account.',
    })
  } else if (inventory.daysSinceConfirmed != null && inventory.daysSinceConfirmed > INVENTORY_STALE_DAYS) {
    flags.push({
      key: 'inventory_stale',
      label: `Inventory last checked ${inventory.daysSinceConfirmed} days ago`,
      severity: inventory.daysSinceConfirmed > INVENTORY_STALE_DAYS * 2 ? 'high' : 'medium',
      href: `${context.accountHref}?tab=inventory`,
      hint: 'Everything shown for stock is modelled from that old reading.',
    })
  }

  if (orders.totalOrders > 0 && inventory.confidence === 'unknown') {
    flags.push({
      key: 'inventory_missing_with_orders',
      label: 'Order data available, inventory data missing',
      severity: 'medium',
      href: `${context.accountHref}?tab=inventory`,
      hint: 'Sell-through and days-of-stock cannot be calculated without an inventory check.',
    })
  }

  if (orders.totalOrders === 0) {
    flags.push({
      key: 'no_order_history',
      label: 'No order history',
      severity: 'medium',
      href: `${context.accountHref}?tab=orders`,
      hint: 'Cadence, reorder and pull-through metrics need at least two orders.',
    })
  }

  const missingReport = tastings.filter((tasting) => tasting.status === 'completed' && !tasting.hasReport)
  if (missingReport.length > 0) {
    flags.push({
      key: 'tasting_report_missing',
      label: `${missingReport.length} completed tasting${missingReport.length === 1 ? '' : 's'} without a report`,
      severity: 'medium',
      href: `${context.accountHref}?tab=sales-intelligence`,
      hint: 'Tasting sales and conversion cannot be measured without the report.',
    })
  }

  const noSales = tastings.filter((tasting) => tasting.hasReport && tasting.bottlesSold == null)
  if (noSales.length > 0) {
    flags.push({
      key: 'no_tasting_sales_recorded',
      label: `${noSales.length} tasting report${noSales.length === 1 ? '' : 's'} with no bottles-sold figure`,
      severity: 'low',
      href: `${context.accountHref}?tab=sales-intelligence`,
      hint: 'The report was submitted but the bottles-sold field was left blank.',
    })
  }

  const missingTaster = tastings.filter((tasting) => !tasting.tasterName)
  if (missingTaster.length > 0) {
    flags.push({
      key: 'missing_taster',
      label: `${missingTaster.length} tasting${missingTaster.length === 1 ? '' : 's'} with no taster assigned`,
      severity: 'low',
      href: `${context.accountHref}?tab=sales-intelligence`,
      hint: 'Taster performance reporting will not include these events.',
    })
  }

  if (context.contactCount === 0) {
    flags.push({
      key: 'no_account_contact',
      label: 'No account contact',
      severity: 'high',
      href: context.contactsHref,
      hint: 'There is nobody to call for a reorder.',
    })
  }

  if (!context.hasSalesRep) {
    flags.push({
      key: 'no_sales_rep',
      label: 'No sales rep assigned',
      severity: 'medium',
      href: `${context.accountHref}?tab=settings`,
      hint: 'The account will not appear in any rep pipeline.',
    })
  }

  return flags
}
