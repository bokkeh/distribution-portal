import { NextResponse } from 'next/server'
import { getPromotionHistory } from '@/actions/progression'
import { toCsv } from '@/lib/progression/csv'
import { formatRank } from '@/lib/progression/ranks'

export async function GET() {
  const rows = await getPromotionHistory()

  const headers = ['Member', 'Change Type', 'Previous Rank', 'New Rank', 'Temporary', 'Reason', 'Notes', 'Assigned By', 'Effective Date']
  const csvRows = rows.map(r => [
    r.memberName,
    r.changeType,
    r.previousLevel != null ? formatRank(r.previousLevel) : '',
    formatRank(r.level),
    r.isTemporary ? 'Yes' : 'No',
    r.reason,
    r.notes,
    r.assignedByName,
    r.effectiveAt.toISOString().slice(0, 10),
  ])

  return new NextResponse(toCsv(headers, csvRows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="team-progression-history-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
