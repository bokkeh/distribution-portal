export const PIPELINE_STAGE_COLOR_TOKENS = [
  'slate',
  'blue',
  'amber',
  'violet',
  'green',
  'red',
  'teal',
  'pink',
] as const

export type PipelineStageColorToken = (typeof PIPELINE_STAGE_COLOR_TOKENS)[number]

export const PIPELINE_STAGE_COLOR_CLASSES: Record<PipelineStageColorToken, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
}

export type PipelineStageRecord = {
  id: string
  stageKey: string
  label: string
  colorToken: string
  position: number
}

export type PipelineStage = PipelineStageRecord & {
  colorClass: string
}

const DEFAULT_PIPELINE_STAGE_DEFS = [
  { stageKey: 'new_lead', label: 'New Lead', colorToken: 'slate', position: 0 },
  { stageKey: 'contacted', label: 'Contacted', colorToken: 'blue', position: 1 },
  { stageKey: 'warm', label: 'Warm', colorToken: 'amber', position: 2 },
  { stageKey: 'qualified', label: 'Qualified', colorToken: 'violet', position: 3 },
  { stageKey: 'active', label: 'Active Customer', colorToken: 'green', position: 4 },
  { stageKey: 'lost', label: 'Lost', colorToken: 'red', position: 5 },
] satisfies Array<Omit<PipelineStageRecord, 'id'>>

export function getDefaultPipelineStages(): PipelineStage[] {
  return DEFAULT_PIPELINE_STAGE_DEFS.map((stage, index) => ({
    id: `default-${stage.stageKey}-${index}`,
    ...stage,
    colorClass: getPipelineStageColorClass(stage.colorToken),
  }))
}

export function normalizePipelineStageKey(value: string | null | undefined): string {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'stage'
}

export function normalizePipelineStageColorToken(value: string | null | undefined): PipelineStageColorToken {
  return PIPELINE_STAGE_COLOR_TOKENS.find((token) => token === value) ?? 'slate'
}

export function getPipelineStageColorClass(value: string | null | undefined): string {
  return PIPELINE_STAGE_COLOR_CLASSES[normalizePipelineStageColorToken(value)]
}

export function coercePipelineStages(stages: Array<PipelineStageRecord> | null | undefined): PipelineStage[] {
  const source = stages?.length ? stages : getDefaultPipelineStages()

  return [...source]
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label))
    .map((stage, index) => ({
      id: stage.id ?? `fallback-${stage.stageKey}-${index}`,
      stageKey: stage.stageKey,
      label: stage.label,
      colorToken: normalizePipelineStageColorToken(stage.colorToken),
      position: stage.position,
      colorClass: getPipelineStageColorClass(stage.colorToken),
    }))
}

export function getDealStage(
  value: string | null | undefined,
  stages?: Array<PipelineStageRecord> | null
): PipelineStage {
  const resolvedStages = coercePipelineStages(stages)
  return resolvedStages.find((stage) => stage.stageKey === value) ?? resolvedStages[0]
}

export function getNextPipelineStageColorToken(existingCount: number): PipelineStageColorToken {
  return PIPELINE_STAGE_COLOR_TOKENS[existingCount % PIPELINE_STAGE_COLOR_TOKENS.length]
}
