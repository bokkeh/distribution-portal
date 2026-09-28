/**
 * Tasting objective / goal validation shared by the scheduling form and the server
 * action, so the two can never disagree about what counts as a measurable goal.
 */

import type { TastingObjectiveValue } from '@/db/schema/tastings'

const OBJECTIVES: TastingObjectiveValue[] = ['sell_through', 'reorder', 'account_opening', 'strategic']

/** Vague goals the spec rejects unless paired with a measurable outcome (a number). */
const GENERIC_GOALS = /\b(brand awareness|awareness|exposure|visibility|presence|engagement|get the word out)\b/i
const MEASURABLE_WORDS = /\b(reorder|second order|follow[- ]?up|deplete|sell out|sell through|launch|lead|listing)\b/i

export function isTastingObjective(value: unknown): value is TastingObjectiveValue {
  return typeof value === 'string' && OBJECTIVES.includes(value as TastingObjectiveValue)
}

/** A goal is measurable when it carries a number, or names a concrete outcome and is not purely "awareness". */
export function goalIsMeasurable(goal: string) {
  const trimmed = goal.trim()
  if (trimmed.length < 4) return false
  const hasNumber = /\d/.test(trimmed)
  if (GENERIC_GOALS.test(trimmed) && !hasNumber) return false
  return hasNumber || MEASURABLE_WORDS.test(trimmed)
}

export type TastingObjectiveInput = {
  objective: TastingObjectiveValue
  primaryGoal: string
  targetBottlesSold: number | null
  targetCasesDepleted: number | null
  targetReorderQuantity: number | null
  estimatedCost: number | null
  tasterPay: number | null
  expectedRoi: string | null
  strategicReason: string | null
  expectedOutcome: string | null
  estimatedValue: number | null
  followUpAction: string | null
  decisionAtScheduling: 'recommended' | 'consider' | 'not_recommended' | null
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function num(formData: FormData, key: string, label: string): { value: number | null } | { error: string } {
  const raw = text(formData, key)
  if (raw == null) return { value: null }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return { error: `${label} must be a non-negative number.` }
  return { value: parsed }
}

/** Reads and validates the objective fields from a scheduling form submission. */
export function parseTastingObjectiveFields(formData: FormData): TastingObjectiveInput | { error: string } {
  const objective = text(formData, 'objective')
  if (!isTastingObjective(objective)) return { error: 'Choose a tasting objective before scheduling.' }

  const primaryGoal = text(formData, 'primaryGoal')
  if (!primaryGoal) return { error: 'Every tasting needs a primary goal.' }
  if (!goalIsMeasurable(primaryGoal)) {
    return { error: 'The goal must be measurable — add a bottle count, a case target, a reorder, or a specific follow-up.' }
  }

  const numbers = {
    targetBottlesSold: num(formData, 'targetBottlesSold', 'Target bottles sold'),
    targetCasesDepleted: num(formData, 'targetCasesDepleted', 'Target cases depleted'),
    targetReorderQuantity: num(formData, 'targetReorderQuantity', 'Target reorder quantity'),
    estimatedCost: num(formData, 'estimatedCost', 'Estimated tasting cost'),
    tasterPay: num(formData, 'tasterPay', 'Taster pay'),
    estimatedValue: num(formData, 'estimatedValue', 'Estimated value'),
  }
  for (const result of Object.values(numbers)) {
    if ('error' in result) return { error: result.error }
  }
  const value = (key: keyof typeof numbers) => (numbers[key] as { value: number | null }).value

  const strategicReason = text(formData, 'strategicReason')
  const expectedOutcome = text(formData, 'expectedOutcome')
  const followUpAction = text(formData, 'followUpAction')

  if (objective === 'strategic') {
    if (!strategicReason || !expectedOutcome || !followUpAction || value('estimatedValue') == null) {
      return { error: 'Strategic tastings need a reason, expected outcome, estimated value and follow-up action.' }
    }
  }

  const decisionRaw = text(formData, 'decisionAtScheduling')
  const decisionAtScheduling =
    decisionRaw === 'recommended' || decisionRaw === 'consider' || decisionRaw === 'not_recommended' ? decisionRaw : null
  if (decisionAtScheduling === 'not_recommended' && formData.get('decisionAcknowledged') !== 'on') {
    return { error: 'This account is not recommended for another tasting. Acknowledge the warning to schedule anyway.' }
  }

  return {
    objective,
    primaryGoal,
    targetBottlesSold: value('targetBottlesSold') == null ? null : Math.round(value('targetBottlesSold') as number),
    targetCasesDepleted: value('targetCasesDepleted'),
    targetReorderQuantity: value('targetReorderQuantity') == null ? null : Math.round(value('targetReorderQuantity') as number),
    estimatedCost: value('estimatedCost'),
    tasterPay: value('tasterPay'),
    expectedRoi: text(formData, 'expectedRoi'),
    strategicReason: objective === 'strategic' ? strategicReason : null,
    expectedOutcome: objective === 'strategic' ? expectedOutcome : null,
    estimatedValue: objective === 'strategic' ? value('estimatedValue') : null,
    followUpAction: objective === 'strategic' ? followUpAction : null,
    decisionAtScheduling,
  }
}
