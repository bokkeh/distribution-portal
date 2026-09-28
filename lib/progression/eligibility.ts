import type { RequirementRow } from './data'
import type { ProgressionRequirementCompletion } from '@/db/schema'
import { performanceValueForKey, type PerformanceSummary } from './metrics'

export type RequirementStatus = 'complete' | 'in_progress' | 'not_started' | 'needs_manager_review' | 'overridden'

export type RequirementProgress = {
  key: string
  label: string
  requirementType: RequirementRow['requirementType']
  isQualitative: boolean
  currentValue: number | null
  targetValue: number | null
  status: RequirementStatus
  overrideReason: string | null
}

export type EligibilityStatus = 'not_yet_eligible' | 'eligible_for_review' | 'approved_for_promotion'

export type EligibilitySummary = {
  requirements: RequirementProgress[]
  requiredCount: number
  requiredCompleteCount: number
  status: EligibilityStatus
  needsManagerReview: boolean
}

export function computeRequirementProgress(
  requirements: RequirementRow[],
  perf: PerformanceSummary,
  daysAtCurrentLevel: number | null,
  manualCompletions: ProgressionRequirementCompletion[]
): RequirementProgress[] {
  const latestManualByKey = new Map<string, ProgressionRequirementCompletion>()
  for (const c of manualCompletions) {
    const existing = latestManualByKey.get(c.requirementKey)
    if (!existing || c.createdAt > existing.createdAt) latestManualByKey.set(c.requirementKey, c)
  }

  return requirements
    .filter(r => r.requirementType !== 'not_applicable')
    .map((r) => {
      const manual = latestManualByKey.get(r.key) ?? null
      if (r.isQualitative) {
        return {
          key: r.key,
          label: r.label,
          requirementType: r.requirementType,
          isQualitative: true,
          currentValue: null,
          targetValue: r.targetNumeric,
          status: manual ? (manual.status === 'overridden' ? 'overridden' : 'complete') : 'needs_manager_review',
          overrideReason: manual?.reason ?? null,
        } satisfies RequirementProgress
      }

      const currentValue = performanceValueForKey(r.key, perf, daysAtCurrentLevel)
      const targetValue = r.targetNumeric
      let status: RequirementStatus
      if (manual) {
        status = manual.status === 'overridden' ? 'overridden' : 'complete'
      } else if (targetValue == null) {
        status = 'complete'
      } else if (currentValue == null) {
        status = 'not_started'
      } else if (currentValue >= targetValue) {
        status = 'complete'
      } else if (currentValue > 0) {
        status = 'in_progress'
      } else {
        status = 'not_started'
      }

      return {
        key: r.key,
        label: r.label,
        requirementType: r.requirementType,
        isQualitative: false,
        currentValue,
        targetValue,
        status,
        overrideReason: manual?.status === 'overridden' ? manual.reason : null,
      } satisfies RequirementProgress
    })
}

export function computeEligibility(requirements: RequirementProgress[], hasApprovedRecommendation: boolean): EligibilitySummary {
  const required = requirements.filter(r => r.requirementType === 'required')
  const measurableRequired = required.filter(r => !r.isQualitative)
  const qualitativeRequired = required.filter(r => r.isQualitative)

  const isMet = (r: RequirementProgress) => r.status === 'complete' || r.status === 'overridden'
  const allMeasurableMet = measurableRequired.every(isMet)
  const anyQualitativePending = qualitativeRequired.some(r => r.status === 'needs_manager_review')

  let status: EligibilityStatus = 'not_yet_eligible'
  if (hasApprovedRecommendation) status = 'approved_for_promotion'
  else if (allMeasurableMet) status = 'eligible_for_review'

  return {
    requirements,
    requiredCount: required.length,
    requiredCompleteCount: required.filter(isMet).length,
    status,
    needsManagerReview: anyQualitativePending,
  }
}
