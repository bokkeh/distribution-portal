export const DEAL_STAGES = [
  { value: 'new_lead',   label: 'New Lead',        color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'contacted',  label: 'Contacted',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'warm',       label: 'Warm',             color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'qualified',  label: 'Qualified',        color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'active',     label: 'Active Customer',  color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost',       label: 'Lost',             color: 'bg-red-100 text-red-700 border-red-200' },
] as const

export type DealStageValue = typeof DEAL_STAGES[number]['value']

export function getDealStage(value: string | null | undefined) {
  return DEAL_STAGES.find(s => s.value === value) ?? DEAL_STAGES[0]
}
