import Link from 'next/link'
import { ArrowRight, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LIKELIHOOD_META, fmtDateRange, fmtShortDate } from '@/lib/pull-through/display'
import type { PullThroughAccountRow } from '@/lib/pull-through/types'

const BOARD_SIZE = 8

/** Rank by likelihood score, then by how far into the cycle the account is. */
export function rankByReorderLikelihood(rows: PullThroughAccountRow[]) {
  return [...rows]
    .filter((row) => row.reorderLikelihood.score != null)
    .sort((left, right) => {
      const scoreDiff = (right.reorderLikelihood.score ?? 0) - (left.reorderLikelihood.score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return (right.orders.daysSinceLastOrder ?? 0) - (left.orders.daysSinceLastOrder ?? 0)
    })
}

/**
 * The direct answer to "who is most likely to reorder next?" — the top accounts by
 * reorder likelihood with the one or two facts that put them there. Every row links
 * to the existing account record; nothing here is stored.
 */
export function ReorderLikelihoodBoard({ rows, viewAllHref }: { rows: PullThroughAccountRow[]; viewAllHref: string }) {
  const ranked = rankByReorderLikelihood(rows).slice(0, BOARD_SIZE)

  if (ranked.length === 0) {
    return null
  }

  const veryLikelyCount = rows.filter((row) => row.reorderLikelihood.level === 'very_likely').length

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-emerald-600" />
              Most likely to reorder next
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Ranked by where each account sits in its own reorder cycle, adjusted for stock on hand.
              {veryLikelyCount > 0 && (
                <>
                  {' '}
                  <span className="font-semibold text-emerald-700">
                    {veryLikelyCount} account{veryLikelyCount === 1 ? ' is' : 's are'} in their reorder window right now.
                  </span>
                </>
              )}
            </p>
          </div>
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
          >
            See all very likely
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ol className="divide-y divide-emerald-100/80">
          {ranked.map((row, index) => {
            const likelihood = row.reorderLikelihood
            const meta = LIKELIHOOD_META[likelihood.level]
            const cadence = row.orders.avgDaysBetweenOrders
            const primaryReason = likelihood.why[1] ?? null

            return (
              <li key={row.accountId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">{index + 1}</span>

                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={row.accountHref}
                      className="truncate font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {row.accountName}
                    </Link>
                    <span className={`inline-flex rounded-md border px-1.5 py-px text-[10px] font-semibold ${meta.chip}`}>
                      {meta.label}
                    </span>
                    {row.city && <span className="text-xs text-slate-500">{row.city}</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{likelihood.headline}</p>
                  {primaryReason && <p className="mt-0.5 text-xs text-slate-500">{primaryReason}</p>}
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-4 text-right sm:w-auto">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Expected</p>
                    <p className="text-xs font-semibold text-slate-800">
                      {fmtDateRange(likelihood.expectedFrom, likelihood.expectedTo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Last order</p>
                    <p className="text-xs font-semibold text-slate-800">
                      {fmtShortDate(row.orders.lastOrderAt)}
                      {row.orders.lastOrderBottles != null && (
                        <span className="font-normal text-slate-500"> · {Math.round(row.orders.lastOrderBottles)} btl</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Cycle</p>
                    <p className="text-xs font-semibold text-slate-800">
                      {cadence == null ? '—' : `every ${Math.round(cadence)}d`}
                    </p>
                  </div>
                </div>

                <div className="w-24 shrink-0">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Likelihood</span>
                    <span className={`font-bold ${meta.text}`}>{likelihood.score}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${likelihood.score ?? 0}%` }} />
                  </div>
                </div>

                <Link
                  href={row.accountHref}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open
                </Link>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
