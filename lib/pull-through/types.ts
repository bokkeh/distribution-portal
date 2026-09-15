/**
 * Account Pull-Through / Sales Intelligence — shared types.
 *
 * Every value here is DERIVED from records that already exist in the portal:
 *   accounts      -> customer_accounts
 *   orders        -> orders + order_items + products
 *   tastings      -> tastings + tasting_reports
 *   inventory     -> account_inventory_on_hand + account_inventory_adjustments
 *   sales rep     -> customer_accounts.assigned_sales_rep_id -> sales_members -> users
 *   CRM activity  -> activity_events + account_notes + sales_route_stops
 *
 * No table in this feature stores a computed metric, and nothing is entered twice.
 */

/** Where a displayed number came from, so the UI can show provenance and deep-link. */
export type SourceRef = {
  /** Human label, e.g. "Inventory check" or "Order". */
  label: string
  /** When the underlying record was captured. */
  at: Date | null
  /** Who entered/owns the underlying record, when the record carries that. */
  byName?: string | null
  byRole?: string | null
  /** The record this number was read from. */
  recordType:
    | 'order'
    | 'tasting'
    | 'tasting_report'
    | 'inventory_on_hand'
    | 'inventory_adjustment'
    | 'account'
    | 'note'
    | 'activity'
    | 'sales_visit'
    | 'derived'
  recordId?: string | null
  /** Deep link into the originating record, resolved per viewer mode. */
  href?: string | null
}

export type ViewerMode = 'admin' | 'staff' | 'sales'

/* ------------------------------------------------------------------ orders */

export type PullThroughOrder = {
  id: string
  accountId: string
  orderedAt: Date
  orderType: 'paid' | 'sample'
  status: string
  cases: number
  bottles: number
  total: number
  /** 0 = initial order, 1 = first reorder, 2+ = subsequent reorders. */
  sequenceIndex: number
  isReorder: boolean
  /** Organic vs tasting-assisted classification; null for sample drops. */
  attribution: OrderAttribution | null
}

/* ------------------------------------------------------------ attribution */

export type OrderAttributionKind = 'organic' | 'assisted'

/**
 * Whether a commercial order was earned by organic consumer demand or pulled through
 * by a paid tasting. Classified automatically from timing and tasting sales; an admin
 * override (stored on the order) always wins.
 */
export type OrderAttribution = {
  kind: OrderAttributionKind
  source: 'auto' | 'override'
  /** The tasting this order is attributed to, when assisted. */
  tastingId: string | null
  tastingAt: Date | null
  daysSinceTasting: number | null
  /** Bottles sold at that tasting, from its report. */
  bottlesSoldAtTasting: number | null
  /** Bottles from the previous order that moved outside the tasting itself. */
  bottlesMovedOutsideTasting: number | null
  why: string
  overrideReason: string | null
}

export type OrderMetrics = {
  totalOrders: number
  totalCases: number
  totalBottles: number
  reorderCount: number
  firstOrderAt: Date | null
  firstOrderBottles: number | null
  firstOrderCases: number | null
  lastOrderAt: Date | null
  lastOrderBottles: number | null
  lastOrderCases: number | null
  previousOrderAt: Date | null
  previousOrderBottles: number | null
  avgOrderBottles: number | null
  avgDaysBetweenOrders: number | null
  /** Population standard deviation of the inter-order gaps, in days. */
  orderGapStdDevDays: number | null
  daysSinceLastOrder: number | null
  firstToFirstReorderDays: number | null
  predictedNextOrderFrom: Date | null
  predictedNextOrderTo: Date | null
  reorderFrequencyLabel: string | null
  /** Bottles per day, inferred from ordering history. */
  bottlesPerDay: number | null
  hasNeverReordered: boolean
  sampleOrderCount: number
}

/* --------------------------------------------------------------- inventory */

export type InventoryConfidence = 'confirmed' | 'estimated' | 'unknown'

export type InventoryPosition = {
  confidence: InventoryConfidence
  /** Best available bottle count. null when genuinely unknown. */
  bottles: number | null
  cases: number | null
  /** The confirmed reading this is based on (null when never checked). */
  confirmedBottles: number | null
  confirmedCases: number | null
  lastConfirmedAt: Date | null
  lastConfirmedByName: string | null
  lastConfirmedByRole: string | null
  daysSinceConfirmed: number | null
  /** Bottles delivered by orders placed after the last confirmed check. */
  bottlesReceivedSinceCheck: number
  /** Modelled depletion since the check, using observed sell-through. */
  bottlesDepletedSinceCheck: number | null
  /** bottles / bottlesPerDay. */
  estimatedDaysOfInventory: number | null
  productCount: number
  source: SourceRef | null
  /** Why the number is labelled the way it is. */
  explanation: string
}

/* ---------------------------------------------------------------- tastings */

export type PullThroughTasting = {
  id: string
  accountId: string
  eventName: string
  occurredAt: Date
  status: string
  tasterUserId: string | null
  tasterName: string | null
  hasReport: boolean
  reportSubmittedByName: string | null
  startTime: string | null
  endTime: string | null
  bottlesSold: number | null
  casesSold: number | null
  samplesServed: number | null
  consumerInteractions: number | null
  /** Shelf stock observations recorded before and after the tasting. */
  bottlesInStockBefore: number | null
  bottlesInStockAfter: number | null
  accountFeedback: string | null
  highlights: string | null
  issues: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  photoUrls: string[]
  /** Next commercial order strictly after the tasting, if any. */
  nextOrderId: string | null
  nextOrderAt: Date | null
  nextOrderBottles: number | null
  nextOrderCases: number | null
  daysToNextOrder: number | null
  within7: boolean
  within14: boolean
  within30: boolean

  /** Why the tasting was booked; null for tastings scheduled before objectives existed. */
  objective: TastingObjective | null
  primaryGoal: string | null
  targetBottlesSold: number | null
  targetCasesDepleted: number | null
  targetReorderQuantity: number | null
  /** What the tasting actually cost: approved invoice → estimate → global default. */
  cost: number
  costSource: 'invoice' | 'estimate' | 'default'
  /** Filled in once orders are attributed. */
  economics: TastingEconomics | null
}

export type TastingObjective = 'sell_through' | 'reorder' | 'account_opening' | 'strategic'

/* --------------------------------------------------------------- economics */

/** Global assumptions; editable by admins, overridable per tasting. */
export type TastingEconomicsSettings = {
  contributionPerCase: number
  defaultTastingCost: number
  /** A reorder inside this many days of a tasting is presumed tasting-assisted. */
  attributionWindowDays: number
  /** Beyond the window, a reorder is still assisted when the tasting sold at least this share of the prior order. */
  assistedSalesShare: number
  bottlesPerCase: number
}

export type ContributionWindow = {
  days: 30 | 60 | 90
  cases: number
  /** Cases ordered in the window that were classified organic (i.e. beyond the attributed reorder). */
  organicCases: number
  contribution: number
  net: number
  roiPercent: number | null
}

export type TastingEconomics = {
  cost: number
  costSource: 'invoice' | 'estimate' | 'default'
  /** Cases from the reorder attributed to this tasting, if any. */
  attributedCases: number
  attributedOrderId: string | null
  contribution: number
  net: number
  /** (net ÷ cost) × 100; null when cost is zero. */
  roiPercent: number | null
  windows: ContributionWindow[]
  /** Strategic tastings are excluded from retail ROI roll-ups. */
  excludedFromRetailRollup: boolean
}

export type AccountVelocity = {
  totalOrders: number
  totalCases: number
  totalBottles: number
  organicCases: number
  assistedCases: number
  organicBottles: number
  assistedBottles: number
  /** Bottles the reports say were sold during tastings themselves. */
  bottlesSoldAtTastings: number
  /** Share of cases earned organically, 0..100. null without commercial orders. */
  organicPercent: number | null
  assistedPercent: number | null
  /** Bottles per week, split by channel. null when the span is too short to measure. */
  bottlesPerWeek: number | null
  organicBottlesPerWeek: number | null
  assistedBottlesPerWeek: number | null
  casesPerMonth: number | null
  daysToSellOneCase: number | null
  /** Days from first to last order, plus one cycle. */
  spanDays: number | null
}

export type DependencyStatus = 'healthy' | 'supported' | 'tasting_dependent' | 'unprofitable_cycle' | 'no_tastings' | 'unknown'

export type DependencyFlag = {
  key:
    | 'tasting_before_reorders'
    | 'spend_near_contribution'
    | 'low_organic_velocity'
    | 'no_organic_after_tastings'
    | 'tasting_requested_after_purchase'
  label: string
  detail: string
}

export type TastingDependency = {
  /** Assisted cases ÷ total cases, 0..100. */
  percent: number | null
  status: DependencyStatus
  headline: string
  flags: DependencyFlag[]
  /** How many of the most recent reorders were preceded by a tasting. */
  recentReordersAssisted: number
  recentReordersConsidered: number
  /** Pattern warning for the timeline, when one applies. */
  patternWarning: string | null
}

export type AccountEconomics = {
  revenue: number
  casesPurchased: number
  contribution: number
  tastingCount: number
  /** Tastings whose cost counts against the account (strategic ones excluded). */
  retailTastingCount: number
  tastingSpend: number
  strategicSpend: number
  netContribution: number
  profitPerTasting: number | null
  netPerCase: number | null
  lifetimeValue: number
  annualizedValue: number | null
  /** Contribution generated per dollar of tasting spend; null without tastings. */
  contributionPerTastingDollar: number | null
}

export type AccountHealthKind =
  | 'growth'
  | 'healthy'
  | 'developing'
  | 'tasting_dependent'
  | 'stalled'
  | 'unprofitable'

export type AccountHealth = {
  kind: AccountHealthKind
  source: 'auto' | 'override'
  overrideReason: string | null
  /** What the automatic rule would say, kept visible under an override. */
  autoKind: AccountHealthKind
  why: string[]
}

export type TastingDecisionKind = 'recommended' | 'consider' | 'not_recommended'

export type TastingDecision = {
  kind: TastingDecisionKind
  headline: string
  detail: string[]
  /** Must be acknowledged before scheduling when true. */
  requiresAcknowledgement: boolean
  facts: {
    currentInventoryBottles: number | null
    lastOrderAt: Date | null
    lastOrderCases: number | null
    lastTastingAt: Date | null
    lastTastingCost: number | null
    tastingsLast90Days: number
    organicPercent: number | null
    assistedPercent: number | null
    dependencyPercent: number | null
    lifetimeContribution: number
    lifetimeTastingSpend: number
    netContribution: number
    organicBottlesPerWeek: number | null
    assistedBottlesPerWeek: number | null
  }
}

export type TastingMetrics = {
  tastingCount: number
  completedCount: number
  reportedCount: number
  lastTastingAt: Date | null
  lastTastingId: string | null
  lastTasterName: string | null
  lastTastingBottlesSold: number | null
  lastTastingNextOrderAt: Date | null
  lastTastingDaysToReorder: number | null
  totalBottlesSoldAtTastings: number
  avgBottlesSoldPerTasting: number | null
  followedBy7: number
  followedBy14: number
  followedBy30: number
  avgDaysToFollowingOrder: number | null
  hasEverHadTasting: boolean
  /** Avg days between orders before the first tasting vs after — correlation, not proof. */
  cadenceBeforeFirstTasting: number | null
  cadenceAfterFirstTasting: number | null
}

/* -------------------------------------------------------------- assessment */

export type AccountTemperature = 'hot' | 'warm' | 'cold' | 'at_risk' | 'new'

export type ScoreComponent = {
  key: string
  label: string
  /** 0..1 */
  value: number
  weight: number
  detail: string
}

export type PullThroughScore = {
  /** 0..100, or null when there is not enough data to score honestly. */
  score: number | null
  components: ScoreComponent[]
  /** Total weight that could actually be evaluated. */
  evaluatedWeight: number
  reason: string
}

/**
 * How likely the account is to place its next commercial order soon, read off its own
 * ordering rhythm and stock position. Answers "who should I call today?" directly.
 */
export type ReorderLikelihoodLevel = 'very_likely' | 'likely' | 'possible' | 'unlikely' | 'unknown'

export type ReorderCyclePosition = 'early' | 'approaching' | 'due' | 'overdue' | 'broken'

export type ReorderLikelihood = {
  level: ReorderLikelihoodLevel
  /** 0..100, or null when there is no reorder pattern to read from. */
  score: number | null
  /** Where the account sits in its own reorder cycle. null without a cadence. */
  cyclePosition: ReorderCyclePosition | null
  /** Expected reorder window inferred from cadence (mirrors OrderMetrics.predictedNextOrder*). */
  expectedFrom: Date | null
  expectedTo: Date | null
  /** Plain-English summary, e.g. "Due now — day 28 of a 30-day cycle". */
  headline: string
  /** The facts that produced the level, in priority order. */
  why: string[]
}

export type RecommendedActionKey =
  | 'call_for_reorder'
  | 'follow_up_after_tasting'
  | 'book_tasting'
  | 'inventory_check_needed'
  | 'sales_visit'
  | 'high_priority'
  | 'win_back'
  | 'first_reorder_push'
  | 'no_action'

export type RecommendedAction = {
  key: RecommendedActionKey
  label: string
  urgency: 'high' | 'medium' | 'low' | 'none'
  /** Every recommendation is explainable — these are the facts that triggered it. */
  why: string[]
}

export type DataQualityFlagKey =
  | 'inventory_unknown'
  | 'inventory_stale'
  | 'no_tasting_sales_recorded'
  | 'missing_taster'
  | 'no_order_history'
  | 'inventory_missing_with_orders'
  | 'no_account_contact'
  | 'no_sales_rep'
  | 'tasting_report_missing'

export type DataQualityFlag = {
  key: DataQualityFlagKey
  label: string
  severity: 'high' | 'medium' | 'low'
  /** Where to go to fix it — always an existing record, never a new form. */
  href: string | null
  hint: string
}

/* ------------------------------------------------------------------ rollup */

export type PullThroughAccountRow = {
  /** The existing customer_accounts.id — the single source of truth. */
  accountId: string
  accountName: string
  accountHref: string
  address: string | null
  city: string | null
  state: string | null
  county: string | null
  market: string | null
  territory: string | null
  accountType: string | null
  accountPriority: string | null
  dealStage: string | null
  distributor: string | null
  phone: string | null
  email: string | null
  primaryContactName: string | null
  contactCount: number
  salesRepId: string | null
  salesRepName: string | null
  salesRepUserId: string | null
  createdAt: Date

  orders: OrderMetrics
  inventory: InventoryPosition
  tastings: TastingMetrics
  temperature: AccountTemperature
  temperatureWhy: string[]
  reorderLikelihood: ReorderLikelihood
  velocity: AccountVelocity
  dependency: TastingDependency
  economics: AccountEconomics
  health: AccountHealth
  pullThrough: PullThroughScore
  recommendation: RecommendedAction
  dataQuality: DataQualityFlag[]

  lastOrderSource: SourceRef | null
  lastTastingSource: SourceRef | null

  /** Last touch of any kind (order, tasting, note, visit, inventory check). */
  lastActivityAt: Date | null
}

/* ---------------------------------------------------------------- timeline */

export type TimelineEventKind =
  | 'order'
  | 'reorder'
  | 'sample_order'
  | 'tasting'
  | 'inventory_check'
  | 'note'
  | 'sales_visit'
  | 'crm_activity'

export type TimelineEvent = {
  id: string
  kind: TimelineEventKind
  at: Date
  title: string
  detail: string | null
  actorName: string | null
  actorRole: string | null
  /** Deep link back to the originating record. */
  href: string | null
  sourceLabel: string
}
