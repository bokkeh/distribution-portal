import { getDealStage } from '@/lib/deal-stages'

export function DealStageBadge({ stage }: { stage: string | null | undefined }) {
  const s = getDealStage(stage)
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.colorClass}`}>
      {s.label}
    </span>
  )
}
