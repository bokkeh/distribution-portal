import { getDealStage } from '@/lib/deal-stages'

export function DealStageBadge({ stage }: { stage: string | null | undefined }) {
  const s = getDealStage(stage)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  )
}
