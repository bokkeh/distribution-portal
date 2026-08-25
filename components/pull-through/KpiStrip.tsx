import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import type { PullThroughKpi } from '@/lib/pull-through/filters'

const TONE_CLASSES: Record<PullThroughKpi['tone'], string> = {
  neutral: 'text-slate-900',
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
}

/**
 * Real-time KPIs. Every tile is computed from the same rows the table renders, and
 * clicking one applies the filter that produces exactly that subset.
 */
export function KpiStrip({ kpis }: { kpis: PullThroughKpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const body = (
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${TONE_CLASSES[kpi.tone]}`}>{kpi.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{kpi.hint}</p>
          </CardContent>
        )

        if (!kpi.href) {
          return (
            <Card key={kpi.key} className="h-full">
              {body}
            </Card>
          )
        }

        return (
          <Link key={kpi.key} href={kpi.href} className="h-full">
            <Card className="h-full transition-shadow hover:border-slate-300 hover:shadow-md">{body}</Card>
          </Link>
        )
      })}
    </div>
  )
}
