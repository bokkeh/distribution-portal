import Link from 'next/link'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AccountTimeline } from '@/components/pull-through/AccountTimeline'
import { SourceChip } from '@/components/pull-through/SourceChip'
import {
  INVENTORY_META,
  NOT_ENOUGH_DATA,
  TEMPERATURE_META,
  fmtDateRange,
  scoreTone,
  urgencyChip,
} from '@/lib/pull-through/display'
import { formatDate } from '@/lib/utils'
import type { AccountIntelligence } from '@/lib/pull-through/data'
import type { ViewerMode } from '@/lib/pull-through/types'

function Stat({
  label,
  value,
  sub,
  tone = 'text-slate-900',
}: {
  label: string
  value: string
  sub?: string | null
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold leading-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  )
}

/**
 * Sales Intelligence — rendered inside the existing account record page rather than
 * as a separate analytics screen. Reads the same records the rest of the page reads.
 */
export function SalesIntelligenceSection({
  intelligence,
  mode,
  basePath,
}: {
  intelligence: AccountIntelligence
  mode: ViewerMode
  basePath: string
}) {
  const { row, tastings, timeline } = intelligence
  const temp = TEMPERATURE_META[row.temperature]
  const inv = INVENTORY_META[row.inventory.confidence]

  const tastingsDesc = [...tastings].reverse()

  return (
    <div className="space-y-6">
      {/* Headline health */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">Sales Intelligence</CardTitle>
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${temp.chip}`}>
              <span aria-hidden>{temp.emoji}</span>
              {temp.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Calculated live from this account&apos;s orders, tastings, inventory checks and CRM activity.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Stat
              label="Current Inventory"
              value={row.inventory.bottles == null ? 'Unknown' : `${Math.round(row.inventory.bottles)} bottles`}
              sub={
                row.inventory.lastConfirmedAt
                  ? `${inv.label} · last confirmed ${formatDate(row.inventory.lastConfirmedAt)}${
                      row.inventory.lastConfirmedByName ? ` by ${row.inventory.lastConfirmedByName}` : ''
                    }`
                  : 'No inventory check on record'
              }
              tone={row.inventory.bottles == null ? 'text-slate-400' : 'text-slate-900'}
            />
            <Stat
              label="Average Reorder Cycle"
              value={
                row.orders.avgDaysBetweenOrders == null
                  ? NOT_ENOUGH_DATA
                  : `${Math.round(row.orders.avgDaysBetweenOrders)} days`
              }
              sub={row.orders.reorderFrequencyLabel}
            />
            <Stat
              label="Days Since Last Order"
              value={row.orders.daysSinceLastOrder == null ? '—' : String(row.orders.daysSinceLastOrder)}
              sub={row.orders.lastOrderAt ? `Last order ${formatDate(row.orders.lastOrderAt)}` : 'No orders yet'}
            />
            <Stat
              label="Predicted Reorder"
              value={fmtDateRange(row.orders.predictedNextOrderFrom, row.orders.predictedNextOrderTo)}
              sub={
                row.orders.avgDaysBetweenOrders == null
                  ? 'Needs two or more orders'
                  : "Projected from this account's own cadence"
              }
            />
            <Stat
              label="Pull-Through Score"
              value={row.pullThrough.score == null ? NOT_ENOUGH_DATA : `${row.pullThrough.score} / 100`}
              sub={row.pullThrough.reason}
              tone={scoreTone(row.pullThrough.score)}
            />
          </div>

          {/* Inventory provenance */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${inv.chip}`}>{inv.label}</span>
              <p className="text-xs text-slate-600">{row.inventory.explanation}</p>
            </div>
            {row.inventory.source && <SourceChip source={row.inventory.source} className="mt-1.5" />}
          </div>

          {/* Recommended action, always explainable */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-bold ${urgencyChip(row.recommendation.urgency)}`}>
                {row.recommendation.label}
              </span>
              <span className="text-xs text-muted-foreground">Recommended next action</span>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why</p>
            <ul className="mt-1 space-y-1">
              {row.recommendation.why.map((reason) => (
                <li key={reason} className="text-sm text-slate-600">
                  • {reason}
                </li>
              ))}
            </ul>
            {row.temperatureWhy.length > 0 && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Why {temp.label.toLowerCase()}
                </p>
                <ul className="mt-1 space-y-1">
                  {row.temperatureWhy.map((reason) => (
                    <li key={reason} className="text-sm text-slate-600">
                      • {reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Score breakdown */}
          {row.pullThrough.components.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Score breakdown</p>
              <div className="mt-2 space-y-2">
                {row.pullThrough.components.map((component) => (
                  <div key={component.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-slate-700">{component.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800"
                        style={{ width: `${Math.round(component.value * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-900">
                      {Math.round(component.value * 100)}
                    </span>
                    <span className="hidden w-72 shrink-0 text-[11px] text-muted-foreground lg:block">
                      {component.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data quality */}
      {row.dataQuality.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Missing Data
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Each item links to the record that resolves it — no duplicate data entry.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {row.dataQuality.map((flag) => (
              <div
                key={flag.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">{flag.hint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={flag.severity === 'high' ? 'destructive' : flag.severity === 'medium' ? 'warning' : 'secondary'}>
                    {flag.severity}
                  </Badge>
                  {flag.href && (
                    <Link href={flag.href} className="text-xs font-medium text-blue-600 hover:underline">
                      Resolve →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tasting to reorder attribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tasting → Reorder</CardTitle>
          <p className="text-xs text-muted-foreground">
            Orders placed after a tasting are shown as <span className="font-medium">associated</span> reorders. Timing is
            calculated from the real tasting and order timestamps — an order following a tasting is a correlation, not
            proof the tasting caused it.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {tastingsDesc.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tastings recorded for this account yet.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Order within 7 days"
                  value={`${row.tastings.followedBy7} / ${row.tastings.tastingCount}`}
                  sub="Tastings followed by an order"
                />
                <Stat
                  label="Order within 14 days"
                  value={`${row.tastings.followedBy14} / ${row.tastings.tastingCount}`}
                  sub="Tastings followed by an order"
                />
                <Stat
                  label="Order within 30 days"
                  value={`${row.tastings.followedBy30} / ${row.tastings.tastingCount}`}
                  sub="Tastings followed by an order"
                />
              </div>

              {(row.tastings.cadenceBeforeFirstTasting != null || row.tastings.cadenceAfterFirstTasting != null) && (
                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <p className="text-xs text-slate-600">
                    Reorder cadence before the first tasting:{' '}
                    <span className="font-semibold">
                      {row.tastings.cadenceBeforeFirstTasting == null
                        ? NOT_ENOUGH_DATA
                        : `${Math.round(row.tastings.cadenceBeforeFirstTasting)} days`}
                    </span>{' '}
                    · after:{' '}
                    <span className="font-semibold">
                      {row.tastings.cadenceAfterFirstTasting == null
                        ? NOT_ENOUGH_DATA
                        : `${Math.round(row.tastings.cadenceAfterFirstTasting)} days`}
                    </span>
                    . Indicative only — a single account cannot separate tasting lift from seasonality.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {tastingsDesc.map((tasting) => (
                  <div key={tasting.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{tasting.eventName}</p>
                        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {formatDate(tasting.occurredAt)}
                          {tasting.tasterName ? ` · Taster: ${tasting.tasterName}` : ' · No taster assigned'}
                          {tasting.startTime && tasting.endTime ? ` · ${tasting.startTime}–${tasting.endTime}` : ''}
                        </p>
                      </div>
                      {!tasting.hasReport && <Badge variant="warning">No report submitted</Badge>}
                    </div>

                    {tasting.hasReport && (
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">Bottles sold</span>
                          <p className="font-semibold text-slate-900">
                            {tasting.bottlesSold ?? <span className="font-normal text-amber-600">Not recorded</span>}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Samples served</span>
                          <p className="font-semibold text-slate-900">{tasting.samplesServed ?? '—'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Interactions</span>
                          <p className="font-semibold text-slate-900">{tasting.consumerInteractions ?? '—'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bottles on shelf</span>
                          <p className="font-semibold text-slate-900">{tasting.bottlesInStock ?? '—'}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      {tasting.nextOrderAt ? (
                        <p className="text-xs text-slate-700">
                          Associated reorder{' '}
                          <span className="font-semibold" suppressHydrationWarning>
                            {formatDate(tasting.nextOrderAt)}
                          </span>{' '}
                          — {Math.round(tasting.nextOrderBottles ?? 0)} bottles ·{' '}
                          <span className="font-semibold">{tasting.daysToNextOrder} days after the tasting</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No order placed after this tasting yet.</p>
                      )}
                    </div>

                    {(tasting.accountFeedback || tasting.followUpNotes || tasting.issues) && (
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {tasting.accountFeedback && <p>Feedback: {tasting.accountFeedback}</p>}
                        {tasting.issues && <p>Issues: {tasting.issues}</p>}
                        {tasting.followUpNotes && <p>Follow-up: {tasting.followUpNotes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Unified timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Unified Timeline</CardTitle>
          <p className="text-xs text-muted-foreground">
            Orders, tastings, inventory checks, notes, sales visits and CRM activity in one thread.
          </p>
        </CardHeader>
        <CardContent>
          <AccountTimeline events={timeline} limit={40} />
        </CardContent>
      </Card>

      {/* Pointers back to the existing tabs, rather than duplicating them here. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Underlying Records</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            { label: `Order history (${row.orders.totalOrders})`, href: `${basePath}?tab=orders` },
            { label: `Inventory (${row.inventory.productCount} SKUs)`, href: `${basePath}?tab=inventory` },
            { label: 'Notes & CRM activity', href: `${basePath}?tab=notes-activity` },
            {
              label: `Contacts (${row.contactCount})`,
              href: mode === 'sales' ? `/sales/accounts/${row.accountId}/contacts` : `/${mode}/crm/${row.accountId}/contacts`,
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
