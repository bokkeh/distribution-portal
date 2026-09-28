import { formatRank } from '@/lib/progression/ranks'
import { formatDate } from './shared'
import { Badge } from '@/components/ui/badge'

type HistoryRow = {
  id: string
  level: number
  previousLevel: number | null
  changeType: string
  isTemporary: boolean
  reason: string
  notes?: string | null
  assignedByName: string | null
  effectiveAt: Date
  memberName?: string
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  initial: 'Initial assignment',
  promotion: 'Promotion',
  demotion: 'Moved down',
  correction: 'Correction',
  temporary: 'Temporary',
  scheduled_review: 'Review outcome',
}

export function PromotionHistoryList({ rows, showMember = false }: { rows: HistoryRow[]; showMember?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">No rank changes recorded yet.</p>

  return (
    <ul className="space-y-3">
      {rows.map(row => (
        <li key={row.id} className="rounded-lg border border-slate-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {showMember && row.memberName && <span className="font-semibold text-slate-900">{row.memberName}</span>}
              <Badge variant="outline" className="text-xs">{CHANGE_TYPE_LABEL[row.changeType] ?? row.changeType}</Badge>
              {row.isTemporary && <Badge variant="outline" className="text-xs text-amber-700 border-amber-200">Temporary</Badge>}
            </div>
            <span className="text-xs text-slate-400">{formatDate(row.effectiveAt)}</span>
          </div>
          <p className="mt-1.5 text-sm text-slate-700">
            {row.previousLevel != null ? `${formatRank(row.previousLevel)} → ${formatRank(row.level)}` : formatRank(row.level)}
          </p>
          <p className="mt-1 text-sm text-slate-600">{row.reason}</p>
          {row.notes && <p className="mt-1 text-xs text-slate-400">Notes: {row.notes}</p>}
          <p className="mt-1 text-xs text-slate-400">By {row.assignedByName ?? 'Unknown'}</p>
        </li>
      ))}
    </ul>
  )
}
