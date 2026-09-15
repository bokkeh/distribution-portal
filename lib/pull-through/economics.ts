/**
 * Tasting economics, account velocity, tasting dependency and account health.
 *
 * Everything here answers one question: is this account creating recurring demand for
 * Wisher, or are we paying for a tasting every time we want it to move another case?
 *
 * Pure functions over the same order / tasting / inventory records the rest of the
 * pull-through feature reads. Nothing is stored except the human inputs they consume
 * (global assumptions, per-tasting objective and cost, admin overrides).
 */

import { daysBetween } from './metrics'
import type {
  AccountEconomics,
  AccountHealth,
  AccountHealthKind,
  AccountVelocity,
  ContributionWindow,
  DependencyFlag,
  DependencyStatus,
  InventoryPosition,
  OrderAttributionKind,
  OrderMetrics,
  PullThroughOrder,
  PullThroughTasting,
  TastingDecision,
  TastingDecisionKind,
  TastingDependency,
  TastingEconomics,
  TastingEconomicsSettings,
} from './types'

/** Starting assumptions for Wisher; editable in settings once the table lands. */
export const DEFAULT_ECONOMICS_SETTINGS: TastingEconomicsSettings = {
  contributionPerCase: 75,
  defaultTastingCost: 90,
  attributionWindowDays: 14,
  assistedSalesShare: 0.5,
  bottlesPerCase: 12,
}

/** Beyond this many days a tasting is never credited for a reorder, however big its sales were. */
const MAX_ASSISTED_DAYS = 45
/** How many recent reorders the "tasting before each reorder" pattern check looks at. */
const PATTERN_LOOKBACK = 2

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return null
  return round((numerator / denominator) * 100, 1)
}

/* ------------------------------------------------------------ attribution */

/**
 * Classifies every commercial order as organic or tasting-assisted.
 *
 * A reorder is assisted when a tasting happened inside the attribution window before
 * it, or — within 45 days — when that tasting alone sold at least half of the previous
 * order. Orders with a stored admin override keep the override. Sample drops are never
 * classified.
 */
export function classifyOrderAttribution(
  commercialOrders: PullThroughOrder[],
  tastings: PullThroughTasting[],
  settings: TastingEconomicsSettings,
  overrides: Map<string, { kind: OrderAttributionKind; reason: string | null }> = new Map(),
): PullThroughOrder[] {
  const happened = tastings.filter((tasting) => tasting.status === 'completed' || tasting.hasReport)

  return commercialOrders.map((order, index) => {
    const previous = index > 0 ? commercialOrders[index - 1] : null
    const before = happened.filter(
      (tasting) =>
        tasting.occurredAt.getTime() <= order.orderedAt.getTime() &&
        // Only tastings since the previous order can have moved the previous order's stock.
        (previous == null || tasting.occurredAt.getTime() > previous.orderedAt.getTime()),
    )
    const tasting = before.length > 0 ? before[before.length - 1] : null
    const days = tasting ? daysBetween(tasting.occurredAt, order.orderedAt) : null
    const soldAtTasting = tasting?.bottlesSold ?? null
    const previousBottles = previous?.bottles ?? null
    const movedOutside =
      previousBottles != null ? Math.max(0, previousBottles - (soldAtTasting ?? 0)) : null

    const override = overrides.get(order.id)
    if (override) {
      return {
        ...order,
        attribution: {
          kind: override.kind,
          source: 'override',
          tastingId: tasting?.id ?? null,
          tastingAt: tasting?.occurredAt ?? null,
          daysSinceTasting: days,
          bottlesSoldAtTasting: soldAtTasting,
          bottlesMovedOutsideTasting: movedOutside,
          why: override.reason ? `Set manually: ${override.reason}` : 'Set manually by an admin',
          overrideReason: override.reason,
        },
      }
    }

    let kind: OrderAttributionKind = 'organic'
    let why: string

    if (!tasting || days == null) {
      why = index === 0 ? 'Initial order — no tasting had been held' : 'No tasting since the previous order'
    } else if (days <= settings.attributionWindowDays) {
      kind = 'assisted'
      why = `Placed ${days} day${days === 1 ? '' : 's'} after a tasting${
        soldAtTasting != null ? ` that sold ${soldAtTasting} bottles` : ''
      }`
    } else if (
      days <= MAX_ASSISTED_DAYS &&
      soldAtTasting != null &&
      previousBottles != null &&
      previousBottles > 0 &&
      soldAtTasting / previousBottles >= settings.assistedSalesShare
    ) {
      kind = 'assisted'
      why = `The tasting ${days} days earlier sold ${soldAtTasting} of the previous ${Math.round(previousBottles)} bottles`
    } else {
      why = `${days} days after the last tasting${
        movedOutside != null && movedOutside > 0 ? ` — about ${Math.round(movedOutside)} bottles moved on their own` : ''
      }`
    }

    return {
      ...order,
      attribution: {
        kind,
        source: 'auto',
        tastingId: tasting?.id ?? null,
        tastingAt: tasting?.occurredAt ?? null,
        daysSinceTasting: days,
        bottlesSoldAtTasting: soldAtTasting,
        bottlesMovedOutsideTasting: movedOutside,
        why,
        overrideReason: null,
      },
    }
  })
}

/* --------------------------------------------------------- tasting economics */

/** Cost precedence: approved taster invoice → estimate entered at scheduling → global default. */
export function resolveTastingCost(
  input: { invoiceTotal: number | null; estimatedCost: number | null },
  settings: TastingEconomicsSettings,
): { cost: number; costSource: PullThroughTasting['costSource'] } {
  if (input.invoiceTotal != null && input.invoiceTotal > 0) return { cost: input.invoiceTotal, costSource: 'invoice' }
  if (input.estimatedCost != null && input.estimatedCost > 0) return { cost: input.estimatedCost, costSource: 'estimate' }
  return { cost: settings.defaultTastingCost, costSource: 'default' }
}

function contributionWindow(
  days: 30 | 60 | 90,
  tasting: PullThroughTasting,
  attributedOrders: PullThroughOrder[],
  settings: TastingEconomicsSettings,
): ContributionWindow {
  const inWindow = attributedOrders.filter((order) => {
    const gap = daysBetween(tasting.occurredAt, order.orderedAt)
    return order.orderedAt.getTime() > tasting.occurredAt.getTime() && gap <= days
  })
  const cases = inWindow.reduce((sum, order) => sum + order.cases, 0)
  const organicCases = inWindow
    .filter((order) => order.attribution?.kind === 'organic')
    .reduce((sum, order) => sum + order.cases, 0)
  const contribution = cases * settings.contributionPerCase
  const net = contribution - tasting.cost
  return {
    days,
    cases: round(cases),
    organicCases: round(organicCases),
    contribution: round(contribution),
    net: round(net),
    roiPercent: tasting.cost > 0 ? round((net / tasting.cost) * 100, 0) : null,
  }
}

/**
 * Per-tasting economics. Immediate contribution counts only the reorder attributed to
 * this tasting; the 30/60/90-day windows add every commercial order that followed, so
 * a tasting that seeds ongoing organic demand is visibly different from one that only
 * pulled a single case through.
 */
export function computeTastingEconomics(
  tasting: PullThroughTasting,
  attributedOrders: PullThroughOrder[],
  settings: TastingEconomicsSettings,
): TastingEconomics {
  const attributed = attributedOrders.find((order) => order.attribution?.tastingId === tasting.id && order.attribution.kind === 'assisted')
  const attributedCases = attributed?.cases ?? 0
  const contribution = attributedCases * settings.contributionPerCase
  const net = contribution - tasting.cost

  return {
    cost: tasting.cost,
    costSource: tasting.costSource,
    attributedCases: round(attributedCases),
    attributedOrderId: attributed?.id ?? null,
    contribution: round(contribution),
    net: round(net),
    roiPercent: tasting.cost > 0 ? round((net / tasting.cost) * 100, 0) : null,
    windows: [30, 60, 90].map((days) => contributionWindow(days as 30 | 60 | 90, tasting, attributedOrders, settings)),
    excludedFromRetailRollup: tasting.objective === 'strategic',
  }
}

/* ----------------------------------------------------------------- velocity */

export function computeAccountVelocity(
  orders: OrderMetrics,
  attributedOrders: PullThroughOrder[],
  tastings: PullThroughTasting[],
  settings: TastingEconomicsSettings,
): AccountVelocity {
  const commercial = attributedOrders.filter((order) => order.orderType === 'paid')
  const organic = commercial.filter((order) => order.attribution?.kind !== 'assisted')
  const assisted = commercial.filter((order) => order.attribution?.kind === 'assisted')

  const sum = (list: PullThroughOrder[], key: 'cases' | 'bottles') => list.reduce((total, order) => total + order[key], 0)

  const totalCases = sum(commercial, 'cases')
  const totalBottles = sum(commercial, 'bottles')
  const organicCases = sum(organic, 'cases')
  const assistedCases = sum(assisted, 'cases')
  const organicBottles = sum(organic, 'bottles')
  const assistedBottles = sum(assisted, 'bottles')

  // Span = first order to last order plus one average cycle, so the final order's
  // stock is assumed to sell through rather than counted as instantaneous.
  let spanDays: number | null = null
  if (orders.firstOrderAt && orders.lastOrderAt && orders.avgDaysBetweenOrders != null && orders.avgDaysBetweenOrders > 0) {
    spanDays = daysBetween(orders.firstOrderAt, orders.lastOrderAt) + orders.avgDaysBetweenOrders
  }
  const perWeek = (bottles: number) => (spanDays != null && spanDays > 0 ? round((bottles / spanDays) * 7, 1) : null)

  const bottlesPerWeek = perWeek(totalBottles)
  const casesPerMonth =
    spanDays != null && spanDays > 0 ? round((totalCases / spanDays) * 30.4, 2) : null
  const bottlesPerDay = spanDays != null && spanDays > 0 ? totalBottles / spanDays : null
  const daysToSellOneCase = bottlesPerDay != null && bottlesPerDay > 0 ? round(settings.bottlesPerCase / bottlesPerDay, 0) : null

  return {
    totalOrders: commercial.length,
    totalCases: round(totalCases),
    totalBottles: round(totalBottles),
    organicCases: round(organicCases),
    assistedCases: round(assistedCases),
    organicBottles: round(organicBottles),
    assistedBottles: round(assistedBottles),
    bottlesSoldAtTastings: tastings.reduce((total, tasting) => total + (tasting.bottlesSold ?? 0), 0),
    organicPercent: pct(organicCases, totalCases),
    assistedPercent: pct(assistedCases, totalCases),
    bottlesPerWeek,
    organicBottlesPerWeek: perWeek(organicBottles),
    assistedBottlesPerWeek: perWeek(assistedBottles),
    casesPerMonth,
    daysToSellOneCase,
    spanDays: spanDays == null ? null : Math.round(spanDays),
  }
}

/* --------------------------------------------------------- account economics */

export function computeAccountEconomics(
  attributedOrders: PullThroughOrder[],
  tastings: PullThroughTasting[],
  velocity: AccountVelocity,
  settings: TastingEconomicsSettings,
  now: Date,
): AccountEconomics {
  const commercial = attributedOrders.filter((order) => order.orderType === 'paid')
  const happened = tastings.filter((tasting) => tasting.status === 'completed' || tasting.hasReport)
  const retail = happened.filter((tasting) => tasting.objective !== 'strategic')
  const strategic = happened.filter((tasting) => tasting.objective === 'strategic')

  const revenue = commercial.reduce((total, order) => total + order.total, 0)
  const contribution = velocity.totalCases * settings.contributionPerCase
  const tastingSpend = retail.reduce((total, tasting) => total + tasting.cost, 0)
  const strategicSpend = strategic.reduce((total, tasting) => total + tasting.cost, 0)
  const netContribution = contribution - tastingSpend

  const firstOrderAt = commercial[0]?.orderedAt ?? null
  const ageDays = firstOrderAt ? Math.max(daysBetween(firstOrderAt, now), 1) : null
  // Annualise only once there is at least a month of history; earlier numbers explode.
  const annualizedValue = ageDays != null && ageDays >= 30 ? round(netContribution * (365 / ageDays)) : null

  return {
    revenue: round(revenue),
    casesPurchased: velocity.totalCases,
    contribution: round(contribution),
    tastingCount: happened.length,
    retailTastingCount: retail.length,
    tastingSpend: round(tastingSpend),
    strategicSpend: round(strategicSpend),
    netContribution: round(netContribution),
    profitPerTasting: retail.length > 0 ? round(netContribution / retail.length) : null,
    netPerCase: velocity.totalCases > 0 ? round(netContribution / velocity.totalCases) : null,
    lifetimeValue: round(netContribution),
    annualizedValue,
    contributionPerTastingDollar: tastingSpend > 0 ? round(contribution / tastingSpend, 2) : null,
  }
}

/* --------------------------------------------------------------- dependency */

export function computeTastingDependency(
  attributedOrders: PullThroughOrder[],
  tastings: PullThroughTasting[],
  velocity: AccountVelocity,
  economics: AccountEconomics,
): TastingDependency {
  const commercial = attributedOrders.filter((order) => order.orderType === 'paid')
  const reorders = commercial.filter((order) => order.isReorder)
  const happened = tastings.filter((tasting) => tasting.status === 'completed' || tasting.hasReport)
  const retailTastings = happened.filter((tasting) => tasting.objective !== 'strategic')
  const flags: DependencyFlag[] = []

  const recent = reorders.slice(-PATTERN_LOOKBACK)
  const recentAssisted = recent.filter((order) => order.attribution?.kind === 'assisted').length

  if (commercial.length === 0) {
    return {
      percent: null,
      status: 'unknown',
      headline: 'No commercial orders yet',
      flags,
      recentReordersAssisted: 0,
      recentReordersConsidered: 0,
      patternWarning: null,
    }
  }

  const percent = velocity.assistedPercent

  if (retailTastings.length === 0) {
    return {
      percent: percent ?? 0,
      status: 'no_tastings',
      headline: 'Every order so far has been organic — no paid tastings held',
      flags,
      recentReordersAssisted: recentAssisted,
      recentReordersConsidered: recent.length,
      patternWarning: null,
    }
  }

  const assistedReorders = reorders.filter((order) => order.attribution?.kind === 'assisted').length

  if (reorders.length >= 2 && assistedReorders / reorders.length >= 0.75) {
    flags.push({
      key: 'tasting_before_reorders',
      label: 'Tasting before nearly every reorder',
      detail: `${assistedReorders} of ${reorders.length} reorders followed a paid tasting.`,
    })
  }
  if (economics.contribution > 0 && economics.tastingSpend >= economics.contribution * 0.8) {
    flags.push({
      key: 'spend_near_contribution',
      label: 'Tasting spend near or above contribution',
      detail: `$${economics.tastingSpend.toFixed(0)} in tastings against $${economics.contribution.toFixed(0)} of case contribution.`,
    })
  }
  if (percent != null && percent >= 75) {
    flags.push({
      key: 'low_organic_velocity',
      label: 'Very low organic velocity',
      detail: `Only ${velocity.organicPercent?.toFixed(0) ?? 0}% of cases were earned without a tasting.`,
    })
  }
  if (retailTastings.length >= 2 && velocity.organicCases < 1) {
    flags.push({
      key: 'no_organic_after_tastings',
      label: '2+ tastings, no organic sell-through',
      detail: `${retailTastings.length} paid tastings and ${velocity.organicCases.toFixed(1)} organic cases.`,
    })
  }

  // Tastings booked within two weeks of buying stock, more than once, read as the
  // account asking Wisher to move what it just bought.
  const bookedRightAfterPurchase = tastings.filter((tasting) =>
    commercial.some((order) => {
      const gap = daysBetween(order.orderedAt, tasting.occurredAt)
      return gap >= 0 && gap <= 14
    }),
  ).length
  if (bookedRightAfterPurchase >= 2) {
    flags.push({
      key: 'tasting_requested_after_purchase',
      label: 'Tastings booked right after purchases',
      detail: `${bookedRightAfterPurchase} tastings were scheduled within two weeks of an order.`,
    })
  }

  let status: DependencyStatus
  if (
    retailTastings.length >= 2 &&
    (economics.tastingSpend >= economics.contribution || (percent != null && percent >= 90))
  ) {
    status = 'unprofitable_cycle'
  } else if (percent != null && percent > 50) {
    status = 'tasting_dependent'
  } else if (percent != null && percent > 25) {
    status = 'supported'
  } else {
    status = 'healthy'
  }

  const headlines: Record<DependencyStatus, string> = {
    healthy: 'Reorders come mainly from organic demand',
    supported: 'Occasional tasting support with real organic sell-through',
    tasting_dependent: 'A large share of sales happen around paid tastings',
    unprofitable_cycle: 'Buys stock, then needs a Wisher-funded tasting to move it',
    no_tastings: 'No paid tastings held',
    unknown: 'Not enough history',
  }

  const patternWarning =
    recent.length >= PATTERN_LOOKBACK && recentAssisted === recent.length
      ? `This account has received a paid tasting before each of its last ${recent.length} reorders. Organic velocity ${
          velocity.organicPercent != null && velocity.organicPercent < 40 ? 'remains low' : 'is holding up'
        }.`
      : null

  return {
    percent,
    status,
    headline: headlines[status],
    flags,
    recentReordersAssisted: recentAssisted,
    recentReordersConsidered: recent.length,
    patternWarning,
  }
}

/* ------------------------------------------------------------------- health */

export function classifyAccountHealth(
  orders: OrderMetrics,
  velocity: AccountVelocity,
  dependency: TastingDependency,
  economics: AccountEconomics,
  inventory: InventoryPosition,
  tastings: TastingMetricsLike,
  accountAgeDays: number,
  override: { kind: AccountHealthKind; reason: string | null } | null = null,
): AccountHealth {
  const why: string[] = []
  let autoKind: AccountHealthKind

  const retailTastings = economics.retailTastingCount
  const slowStock =
    inventory.estimatedDaysOfInventory != null &&
    orders.avgDaysBetweenOrders != null &&
    inventory.estimatedDaysOfInventory > orders.avgDaysBetweenOrders * 2
  const frequencyImproving =
    tastings.cadenceBeforeFirstTasting != null &&
    tastings.cadenceAfterFirstTasting != null &&
    tastings.cadenceAfterFirstTasting < tastings.cadenceBeforeFirstTasting

  if (retailTastings >= 2 && economics.tastingSpend > economics.contribution) {
    autoKind = 'unprofitable'
    why.push(`$${economics.tastingSpend.toFixed(0)} of tasting spend exceeds $${economics.contribution.toFixed(0)} of case contribution`)
  } else if (dependency.status === 'tasting_dependent' || dependency.status === 'unprofitable_cycle') {
    autoKind = 'tasting_dependent'
    why.push(`${dependency.percent?.toFixed(0) ?? 0}% of cases were tasting-assisted`)
  } else if (retailTastings >= 1 && slowStock && orders.reorderCount >= 1) {
    autoKind = 'stalled'
    why.push(`About ${Math.round(inventory.estimatedDaysOfInventory ?? 0)} days of stock on hand despite tasting support`)
  } else if (orders.totalOrders <= 2 || accountAgeDays < 90) {
    autoKind = 'developing'
    why.push(orders.totalOrders <= 2 ? `${orders.totalOrders} order${orders.totalOrders === 1 ? '' : 's'} on record` : 'Account is under 90 days old')
  } else if ((velocity.organicPercent ?? 0) >= 60 && (frequencyImproving || orders.reorderCount >= 3)) {
    autoKind = 'growth'
    why.push(`${velocity.organicPercent?.toFixed(0)}% organic with ${orders.reorderCount} reorders`)
    if (frequencyImproving) why.push('Reorder frequency has improved since the first tasting')
  } else if (orders.reorderCount >= 2 && (dependency.percent ?? 0) <= 30) {
    autoKind = 'healthy'
    why.push(`${orders.reorderCount} reorders with limited tasting support`)
  } else {
    autoKind = 'developing'
    why.push('Pattern not yet established')
  }

  return {
    kind: override?.kind ?? autoKind,
    source: override ? 'override' : 'auto',
    overrideReason: override?.reason ?? null,
    autoKind,
    why,
  }
}

type TastingMetricsLike = {
  cadenceBeforeFirstTasting: number | null
  cadenceAfterFirstTasting: number | null
}

/* --------------------------------------------------------- decision panel */

/**
 * "Should we schedule another tasting?" — the account's economics in one place, with
 * a recommendation the scheduler has to acknowledge when the answer is no.
 */
export function buildTastingDecision(input: {
  orders: OrderMetrics
  inventory: InventoryPosition
  tastings: PullThroughTasting[]
  velocity: AccountVelocity
  dependency: TastingDependency
  economics: AccountEconomics
  health: AccountHealth
  settings: TastingEconomicsSettings
  now: Date
}): TastingDecision {
  const { orders, inventory, tastings, velocity, dependency, economics, health, settings, now } = input
  const happened = tastings.filter((tasting) => tasting.status === 'completed' || tasting.hasReport)
  const lastTasting = happened[happened.length - 1] ?? null
  const last90 = happened.filter((tasting) => daysBetween(tasting.occurredAt, now) <= 90).length

  const facts: TastingDecision['facts'] = {
    currentInventoryBottles: inventory.bottles,
    lastOrderAt: orders.lastOrderAt,
    lastOrderCases: orders.lastOrderCases,
    lastTastingAt: lastTasting?.occurredAt ?? null,
    lastTastingCost: lastTasting?.cost ?? null,
    tastingsLast90Days: last90,
    organicPercent: velocity.organicPercent,
    assistedPercent: velocity.assistedPercent,
    dependencyPercent: dependency.percent,
    lifetimeContribution: economics.contribution,
    lifetimeTastingSpend: economics.tastingSpend,
    netContribution: economics.netContribution,
    organicBottlesPerWeek: velocity.organicBottlesPerWeek,
    assistedBottlesPerWeek: velocity.assistedBottlesPerWeek,
  }

  const detail: string[] = []
  let kind: TastingDecisionKind

  if (orders.totalOrders === 0) {
    kind = 'recommended'
    detail.push('No orders yet — an account-opening tasting is how demand gets established here.')
  } else if (health.kind === 'unprofitable' || dependency.status === 'unprofitable_cycle') {
    kind = 'not_recommended'
    detail.push(
      `This account has purchased ${velocity.totalCases.toFixed(1)} cases and received ${economics.retailTastingCount} paid tasting${
        economics.retailTastingCount === 1 ? '' : 's'
      }.`,
    )
    detail.push(`Case contribution: ${velocity.totalCases.toFixed(1)} × $${settings.contributionPerCase} = $${economics.contribution.toFixed(0)}`)
    detail.push(`Tasting spend: $${economics.tastingSpend.toFixed(0)}`)
    detail.push(`Net before other costs: ${economics.netContribution < 0 ? '-' : ''}$${Math.abs(economics.netContribution).toFixed(0)}`)
    detail.push(`Organic cases sold: ${velocity.organicCases.toFixed(1)}`)
    detail.push('This account is currently costing Wisher more in tasting support than it generates in contribution profit.')
  } else if (health.kind === 'tasting_dependent' || dependency.status === 'tasting_dependent' || last90 >= 2) {
    kind = 'consider'
    detail.push(`${dependency.percent?.toFixed(0) ?? 0}% of cases were tasting-assisted; ${last90} tasting${last90 === 1 ? '' : 's'} in the last 90 days.`)
    detail.push('Require a specific sell-through or reorder goal before booking.')
    if (inventory.bottles != null && orders.avgDaysBetweenOrders != null && inventory.estimatedDaysOfInventory != null) {
      detail.push(`Roughly ${Math.round(inventory.estimatedDaysOfInventory)} days of stock on hand against a ${Math.round(orders.avgDaysBetweenOrders)}-day reorder cycle.`)
    }
  } else if (orders.totalOrders === 1 || health.kind === 'developing') {
    kind = 'recommended'
    detail.push('Early account — tasting support here is acquisition, not subsidy.')
    if (economics.retailTastingCount > 0) detail.push(`${economics.retailTastingCount} tasting${economics.retailTastingCount === 1 ? '' : 's'} held so far.`)
  } else {
    kind = 'recommended'
    detail.push(`${velocity.organicPercent?.toFixed(0) ?? 0}% of cases were organic; net contribution is $${economics.netContribution.toFixed(0)} after tastings.`)
    detail.push('Make sure this tasting has a clear incremental purpose (new SKU, new shelf position, seasonal push).')
  }

  const headlines: Record<TastingDecisionKind, string> = {
    recommended: 'Recommended — strong organic demand or early-stage acquisition',
    consider: 'Consider — moderate tasting dependency; require a measurable goal',
    not_recommended: 'Not recommended — account appears dependent on paid tastings to move inventory',
  }

  return {
    kind,
    headline: headlines[kind],
    detail,
    requiresAcknowledgement: kind === 'not_recommended',
    facts,
  }
}
