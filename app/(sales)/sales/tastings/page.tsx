import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { loadPullThroughDataset, resolvePullThroughScope } from '@/lib/pull-through/data'
import { fmtMoney, fmtPercent } from '@/lib/pull-through/display'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { RequestTastingModal } from './RequestTastingModal'

export default async function SalesTastingsPage({ searchParams }: { searchParams: Promise<{ account?: string; date?: string; tasting?: string }> }) {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const params = await searchParams
  const scope = await resolvePullThroughScope(session)
  const dataset = await loadPullThroughDataset(scope)
  const accounts = dataset.rows.filter(row => !params.account || row.accountId === params.account)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Tasting economics &amp; reports</h1><p className="text-sm text-slate-500">{scope.viewerLabel} · All recorded history through {formatEasternDateTime(dataset.generatedAt)}</p></div><RequestTastingModal accounts={dataset.rows.map(row=>({id:row.accountId,companyName:row.accountName}))} initialAccountId={params.account} initialDate={params.date}/></div>
    <Link href="/sales/tastings/schedule" className="inline-flex rounded-md bg-primary px-4 py-2 text-white">Quick schedule tasting</Link>
    <p className="rounded-xl border bg-slate-50 p-4 text-sm">These figures use the same source records and calculation logic as CRM economics. Timing alone does not prove tasting-driven sales. Wholesale purchases and report bottle sales are distinct. Contribution is an estimate using ${dataset.settings.contributionPerCase} per case. ROI = (explicitly attributed case contribution − approved invoice cost) ÷ that cost × 100; missing attribution or actual cost means insufficient data. No revenue-before/after comparison is presented as ROI. Historical coverage may be incomplete.</p>
    {!accounts.length && <p>No accounts in your authorized scope match this selection.</p>}
    {accounts.map(account=>{
      const tastings=dataset.tastingsByAccount.get(account.accountId) ?? []
      const held=tastings.filter(t=>t.status==='completed'||t.hasReport)
      const shown=params.tasting ? tastings.filter(t=>t.id===params.tasting) : [...tastings].reverse()
      return <Card key={account.accountId}><CardHeader><CardTitle><Link href={`/sales/accounts/${account.accountId}?tab=economics`} className="text-blue-700 hover:underline">{account.accountName}</Link></CardTitle><p className="text-sm">{held.length} completed or reported tastings · {tastings.filter(t=>t.status==='completed').length} marked completed · {tastings.filter(t=>t.hasReport).length} reports</p></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3"><p>Observed revenue: {fmtMoney(account.economics.revenue)}</p><p>Estimated gross contribution: {fmtMoney(account.economics.contribution)}</p><p>Approved invoice expense: {fmtMoney(account.economics.approvedTastingSpend)}</p><p>Expense estimates without approved invoices: {fmtMoney(account.economics.estimatedTastingSpend)}</p><p>Estimated net contribution: {fmtMoney(account.economics.netContribution)}</p><p>Tasting dependency: {fmtPercent(account.dependency.percent)}</p></div>
        <p className="text-sm text-slate-600">{account.dependency.headline} Unknown attribution: {account.velocity.unknownCases.toFixed(1)} case equivalents.</p>
        {!shown.length && <p className="text-sm text-slate-500">No matching tasting reports.</p>}
        {shown.map(t=><details key={t.id} id={`tasting-${t.id}`} open={params.tasting===t.id} className="rounded border p-3 text-sm"><summary>{formatEasternDateTime(t.occurredAt, t.timeZone)} · {t.eventName} · {t.tasterName ?? t.reportSubmittedByName ?? 'Unassigned'} · {t.status} · {t.hasReport ? `Bottles sold: ${t.bottlesSold ?? 'Not recorded'}` : 'Report pending'} · ROI: {fmtPercent(t.economics?.roiPercent)}</summary>
          <div className="mt-3 space-y-2"><p>Report: {t.hasReport ? 'Submitted' : 'Pending'} · Samples served: {t.samplesServed ?? 'Not recorded'} · Cases sold: {t.casesSold ?? 'Not recorded'}</p><p>Cost: {fmtMoney(t.cost)} ({t.costSource}) · Attributed cases: {t.economics?.attributedCases ?? 'Unknown'} · Estimated attributed net: {fmtMoney(t.economics?.net)}</p><p>Feedback: {t.accountFeedback ?? 'Not recorded'}</p><p>Highlights: {t.highlights ?? 'Not recorded'}</p><p>Issues: {t.issues ?? 'Not recorded'}</p><p>Follow-up: {t.followUpNotes ?? 'Not recorded'}</p><p>Submitted by: {t.reportSubmittedByName ?? 'Not recorded'}</p></div>
        </details>)}
      </CardContent></Card>
    })}
  </div>
}
