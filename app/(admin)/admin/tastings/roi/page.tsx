import { db } from '@/db'
import { tastings, tastingReports, tasterInvoices, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { desc, eq, sql } from 'drizzle-orm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, DollarSign, Wine, Users } from 'lucide-react'

export default async function TastingROIPage() {
  await requireFeature('tastings', 'admin')

  const rows = await db
    .select({
      tastingId: tastings.id,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      status: tastings.status,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      tasterName: users.name,
      // report data
      bottlesSold: tastingReports.bottlesSold,
      casesSold: tastingReports.casesSold,
      samplesServed: tastingReports.samplesServed,
      consumerInteractions: tastingReports.consumerInteractions,
      // invoice data
      invoiceCost: tasterInvoices.totalAmount,
      invoiceStatus: tasterInvoices.status,
    })
    .from(tastings)
    .leftJoin(users, eq(tastings.assignedUserId, users.id))
    .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
    .leftJoin(tasterInvoices, eq(tasterInvoices.tastingId, tastings.id))
    .where(eq(tastings.status, 'completed'))
    .orderBy(desc(tastings.scheduledAt))

  // Aggregate stats
  const withReport = rows.filter(r => r.bottlesSold != null)
  const totalBottles = withReport.reduce((s, r) => s + (r.bottlesSold ?? 0), 0)
  const totalCases = withReport.reduce((s, r) => s + (r.casesSold ?? 0), 0)
  const totalSamples = withReport.reduce((s, r) => s + (r.samplesServed ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + Number(r.invoiceCost ?? 0), 0)
  const totalInteractions = withReport.reduce((s, r) => s + (r.consumerInteractions ?? 0), 0)
  const avgConversion = totalInteractions > 0 ? ((totalBottles / totalInteractions) * 100).toFixed(1) : '0'
  const costPerBottle = totalBottles > 0 ? totalCost / totalBottles : null

  // Top performers by bottles sold
  const byTaster: Record<string, { name: string; bottles: number; cost: number; events: number }> = {}
  for (const r of rows) {
    const name = r.tasterName ?? 'Unknown'
    if (!byTaster[name]) byTaster[name] = { name, bottles: 0, cost: 0, events: 0 }
    byTaster[name].bottles += r.bottlesSold ?? 0
    byTaster[name].cost += Number(r.invoiceCost ?? 0)
    byTaster[name].events += 1
  }
  const tasterRankings = Object.values(byTaster).sort((a, b) => b.bottles - a.bottles)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/tastings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasting ROI Report</h1>
          <p className="mt-1 text-muted-foreground">Performance and return on investment across all completed tastings.</p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Taster Cost</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totalCost)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rows.length} completed tastings</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3"><DollarSign className="h-5 w-5 text-red-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bottles Sold</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{totalBottles}</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalCases} cases · {totalSamples} samples</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-3"><Wine className="h-5 w-5 text-violet-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Conversion Rate</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{avgConversion}%</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalInteractions} total interactions</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cost Per Bottle Sold</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {costPerBottle != null ? formatCurrency(costPerBottle) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Taster cost ÷ bottles sold</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3"><Users className="h-5 w-5 text-amber-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Taster leaderboard */}
        {tasterRankings.length > 0 && (
          <Card className="xl:col-span-1">
            <CardHeader><CardTitle className="text-base">Taster Leaderboard</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {tasterRankings.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                      ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.events} events · {formatCurrency(t.cost)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{t.bottles} bottles</p>
                    <p className="text-xs text-muted-foreground">
                      {t.cost > 0 && t.bottles > 0 ? `${formatCurrency(t.cost / t.bottles)}/btl` : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Per-tasting table */}
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-base">All Completed Tastings</CardTitle></CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No completed tastings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taster</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bottles</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interactions</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conv %</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">$/Btl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const interactions = row.consumerInteractions ?? 0
                      const bottles = row.bottlesSold ?? 0
                      const conv = interactions > 0 ? ((bottles / interactions) * 100).toFixed(0) : null
                      const cost = Number(row.invoiceCost ?? 0)
                      const costPerBtl = bottles > 0 && cost > 0 ? cost / bottles : null
                      return (
                        <tr key={row.tastingId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 leading-tight">{row.eventName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(row.scheduledAt)} · {[row.storeCity, row.storeState].filter(Boolean).join(', ') || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.tasterName ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{bottles > 0 ? bottles : '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{interactions > 0 ? interactions : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {conv != null ? (
                              <Badge variant={Number(conv) >= 20 ? 'success' : Number(conv) >= 10 ? 'warning' : 'secondary'} className="text-[10px]">
                                {conv}%
                              </Badge>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{cost > 0 ? formatCurrency(cost) : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {costPerBtl != null ? (
                              <span className={`text-sm font-semibold ${costPerBtl < 10 ? 'text-emerald-600' : costPerBtl < 25 ? 'text-amber-600' : 'text-red-600'}`}>
                                {formatCurrency(costPerBtl)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
