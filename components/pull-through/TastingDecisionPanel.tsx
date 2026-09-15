import { CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DECISION_META, NOT_ENOUGH_DATA, fmtMoney, fmtPercent } from '@/lib/pull-through/display'
import { formatDate } from '@/lib/utils'
import type { TastingDecision, TastingEconomicsSettings } from '@/lib/pull-through/types'

function Fact({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

/**
 * "Should we schedule another tasting?" — the account's economics in one place with a
 * recommendation. Rendered on the account's Economics tab and inside the scheduling
 * flow, where a Not Recommended verdict must be acknowledged before booking.
 */
export function TastingDecisionPanel({
  decision,
  settings,
  compact = false,
  children,
}: {
  decision: TastingDecision
  settings: TastingEconomicsSettings
  compact?: boolean
  children?: React.ReactNode
}) {
  const meta = DECISION_META[decision.kind]
  const { facts } = decision
  const netTone = facts.netContribution > 0 ? 'text-emerald-700' : facts.netContribution < 0 ? 'text-rose-700' : 'text-slate-900'

  return (
    <Card className={`border ${meta.panel}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-slate-600" />
            Should we schedule another tasting?
          </CardTitle>
          <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
        </div>
        <p className="text-sm font-medium text-slate-800">{decision.headline}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {decision.detail.map((line) => (
            <li key={line} className="text-sm text-slate-700">
              • {line}
            </li>
          ))}
        </ul>

        <div className={`grid gap-2 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-6'}`}>
          <Fact label="Current inventory" value={facts.currentInventoryBottles == null ? 'Unknown' : `${Math.round(facts.currentInventoryBottles)} btl`} />
          <Fact label="Last order" value={facts.lastOrderAt ? `${formatDate(facts.lastOrderAt)}${facts.lastOrderCases != null ? ` · ${facts.lastOrderCases} cs` : ''}` : 'None'} />
          <Fact label="Last tasting" value={facts.lastTastingAt ? `${formatDate(facts.lastTastingAt)}${facts.lastTastingCost != null ? ` · ${fmtMoney(facts.lastTastingCost)}` : ''}` : 'None'} />
          <Fact label="Tastings, last 90 days" value={String(facts.tastingsLast90Days)} />
          <Fact label="Organic velocity" value={facts.organicPercent == null ? NOT_ENOUGH_DATA : fmtPercent(facts.organicPercent)} tone="text-emerald-700" />
          <Fact label="Tasting dependency" value={facts.dependencyPercent == null ? NOT_ENOUGH_DATA : fmtPercent(facts.dependencyPercent)} tone="text-violet-700" />
          <Fact label="Organic btl / week" value={facts.organicBottlesPerWeek == null ? NOT_ENOUGH_DATA : facts.organicBottlesPerWeek.toFixed(1)} tone="text-emerald-700" />
          <Fact label="Assisted btl / week" value={facts.assistedBottlesPerWeek == null ? NOT_ENOUGH_DATA : facts.assistedBottlesPerWeek.toFixed(1)} tone="text-violet-700" />
          <Fact label="Lifetime contribution" value={fmtMoney(facts.lifetimeContribution)} />
          <Fact label="Lifetime tasting spend" value={facts.lifetimeTastingSpend > 0 ? `-${fmtMoney(facts.lifetimeTastingSpend)}` : '$0'} tone={facts.lifetimeTastingSpend > 0 ? 'text-rose-700' : 'text-slate-900'} />
          <Fact label="Net after tastings" value={fmtMoney(facts.netContribution)} tone={netTone} />
          <Fact label="Assumptions" value={`$${settings.contributionPerCase}/case · $${settings.defaultTastingCost}/tasting`} tone="text-slate-600" />
        </div>

        {children}
      </CardContent>
    </Card>
  )
}
