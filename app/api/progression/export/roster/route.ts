import { NextResponse } from 'next/server'
import { getRoster } from '@/actions/progression'
import { toCsv } from '@/lib/progression/csv'
import { formatRank } from '@/lib/progression/ranks'

export async function GET() {
  const { entries, permissions } = await getRoster()
  if (!permissions.canExportReports) {
    return NextResponse.json({ error: 'Not permitted.' }, { status: 403 })
  }

  const headers = [
    'Name', 'Email', 'Role', 'Active', 'Rank', 'Career Stage', 'Market/Region', 'Manager',
    'Tastings Completed', 'Bottles Sold', 'Cases Sold', 'Avg Bottles/Tasting', 'Accounts Opened',
    'Reorders Influenced', 'Training Sessions', 'Team Members Trained', 'Reporting Completion %',
    'Reliability %', 'Next Rank', 'Progress to Next %', 'Eligibility', 'Last Activity',
  ]

  const rows = entries.map(e => [
    e.name, e.email, e.role, e.active ? 'Yes' : 'No', formatRank(e.level), e.careerStage, e.homeRegion, e.managerName,
    e.performance.tastingsCompleted, e.performance.bottlesSold, e.performance.casesSold, e.performance.avgBottlesPerTasting,
    e.performance.accountsOpened, e.performance.reordersInfluenced, e.performance.trainingSessionsCompleted,
    e.performance.teamMembersTrained, e.performance.reportingCompletionPct, e.performance.reliabilityPct,
    e.nextLevel ? formatRank(e.nextLevel) : 'Max level', e.progressPercent, e.eligibilityStatus,
    e.lastActivityAt ? e.lastActivityAt.toISOString().slice(0, 10) : '',
  ])

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="team-progression-roster-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
