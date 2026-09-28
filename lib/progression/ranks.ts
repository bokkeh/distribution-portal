/**
 * The Wisher Vodka ten-level rank ladder. Names, levels and career stages are fixed by the
 * program design — only the numeric/qualitative requirements per rank are admin-editable
 * (see `progression_rank_requirements` and `getRankRequirements` in `data.ts`).
 */

export const MIN_LEVEL = 1
export const MAX_LEVEL = 10

export type RankDefinition = {
  level: number
  name: string
  careerStage: string
  milestone: string
}

export const RANKS: RankDefinition[] = [
  { level: 1, name: 'First Pour', careerStage: 'New Team Member', milestone: 'Joins the team and completes the starter-kit requirements' },
  { level: 2, name: 'Crowd Starter', careerStage: 'Active Brand Ambassador', milestone: 'Completes an established number of tastings and bottle sales' },
  { level: 3, name: 'Pour Performer', careerStage: 'Advanced Brand Ambassador', milestone: 'Reaches higher tasting, sales, and reliability targets' },
  { level: 4, name: 'Brand Guide', careerStage: 'Tasting Trainer', milestone: 'Trains and supports new tasting team members' },
  { level: 5, name: 'Market Maker', careerStage: 'Salesperson', milestone: 'Earns expanded account-development and sales opportunities' },
  { level: 6, name: 'Sales Coach', careerStage: 'Sales Trainer', milestone: 'Trains salespeople and supports team performance' },
  { level: 7, name: 'Territory Lead', careerStage: 'Local or Regional Sales', milestone: 'Owns performance across an assigned territory' },
  { level: 8, name: 'Market Director', careerStage: 'State or Multi-Region Sales', milestone: 'Leads a state or multiple regional markets' },
  { level: 9, name: 'National Director', careerStage: 'National Sales', milestone: 'Leads national sales strategy and performance' },
  { level: 10, name: 'Global Ambassador', careerStage: 'Global Sales', milestone: 'Leads international sales expansion and global partnerships' },
]

export function getRank(level: number): RankDefinition {
  return RANKS.find(r => r.level === level) ?? RANKS[0]
}

export function getNextRank(level: number): RankDefinition | null {
  if (level >= MAX_LEVEL) return null
  return getRank(level + 1)
}

export function formatRank(level: number): string {
  const rank = getRank(level)
  return `Level ${rank.level}: ${rank.name}`
}

/** A rank from this level up carries trainer permissions within Team Progression (data-driven, no separate role). */
export const TRAINER_LEVEL_THRESHOLD = 4
/** A rank from this level up carries sales-leadership permissions within Team Progression. */
export const SALES_LEADER_LEVEL_THRESHOLD = 7

/* --------------------------------------------------------- requirement catalog */

export type RequirementUnit = 'tastings' | 'bottles' | 'cases' | 'bottles_per_tasting' | 'accounts' | 'reorders' | 'people' | 'percent' | 'days' | 'boolean'

export type RequirementDef = {
  key: string
  label: string
  unit: RequirementUnit
  /** Computed automatically from existing records; false means it needs manual/manager input. */
  computed: boolean
}

export const REQUIREMENT_DEFS: RequirementDef[] = [
  { key: 'min_tastings', label: 'Minimum completed tastings', unit: 'tastings', computed: true },
  { key: 'min_bottles_sold', label: 'Minimum bottles sold', unit: 'bottles', computed: true },
  { key: 'min_cases_sold', label: 'Minimum cases sold', unit: 'cases', computed: true },
  { key: 'min_avg_bottles_per_tasting', label: 'Minimum average bottles sold per tasting', unit: 'bottles_per_tasting', computed: true },
  { key: 'min_accounts_opened', label: 'Minimum active accounts opened', unit: 'accounts', computed: true },
  { key: 'min_reorders_influenced', label: 'Minimum account reorders influenced', unit: 'reorders', computed: true },
  { key: 'min_team_members_trained', label: 'Minimum new team members trained', unit: 'people', computed: true },
  { key: 'min_training_completion_pct', label: 'Minimum training completion percentage', unit: 'percent', computed: false },
  { key: 'min_time_at_previous_level_days', label: 'Minimum time at previous level', unit: 'days', computed: true },
  { key: 'reporting_completion_pct', label: 'Reporting-completion requirement', unit: 'percent', computed: true },
  { key: 'reliability_pct', label: 'Reliability / attendance requirement', unit: 'percent', computed: true },
  { key: 'manager_approval', label: 'Manager approval required', unit: 'boolean', computed: false },
]

export function getRequirementDef(key: string): RequirementDef | null {
  return REQUIREMENT_DEFS.find(d => d.key === key) ?? null
}

export function isCustomRequirementKey(key: string) {
  return key.startsWith('custom:')
}

/** Sensible starting thresholds seeded the first time a rank's requirements are viewed with none configured. */
export const DEFAULT_REQUIREMENT_TARGETS: Record<number, Partial<Record<string, number>>> = {
  1: {},
  2: { min_tastings: 10, min_bottles_sold: 40, reliability_pct: 90 },
  3: { min_tastings: 25, min_bottles_sold: 120, min_avg_bottles_per_tasting: 4, reliability_pct: 92, reporting_completion_pct: 95 },
  4: { min_tastings: 40, min_bottles_sold: 200, reporting_completion_pct: 95, min_time_at_previous_level_days: 60 },
  5: { min_accounts_opened: 3, min_reorders_influenced: 5, min_time_at_previous_level_days: 90 },
  6: { min_team_members_trained: 3, min_accounts_opened: 8, min_time_at_previous_level_days: 120 },
  7: { min_accounts_opened: 15, min_reorders_influenced: 20, min_time_at_previous_level_days: 180 },
  8: { min_accounts_opened: 30, min_time_at_previous_level_days: 270 },
  9: { min_time_at_previous_level_days: 365 },
  10: { min_time_at_previous_level_days: 365 },
}

export const DEFAULT_STARTER_KIT_ITEMS: { label: string; description?: string; tracksExpiry?: boolean }[] = [
  { label: 'Employment or contractor documents completed' },
  { label: 'Payment information submitted' },
  { label: 'Alcohol-service certifications uploaded', tracksExpiry: true },
  { label: 'Brand training completed' },
  { label: 'Product knowledge quiz passed' },
  { label: 'Tasting procedure reviewed' },
  { label: 'Sales and compliance guidelines accepted' },
  { label: 'Uniform or event materials received' },
  { label: 'First activation scheduled' },
  { label: 'Reporting process understood' },
]
