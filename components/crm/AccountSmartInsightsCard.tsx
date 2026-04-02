import Link from 'next/link'
import { Sparkles, AlertTriangle, Clock3, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeInTimeZone } from '@/lib/timezones'
import type { SmartInsightsResult } from '@/lib/crm/smart-insights'

function priorityVariant(priority: 'high' | 'medium' | 'low'): 'destructive' | 'warning' | 'secondary' {
  if (priority === 'high') return 'destructive'
  if (priority === 'medium') return 'warning'
  return 'secondary'
}

export function AccountSmartInsightsCard({ insights }: { insights: SmartInsightsResult }) {
  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Smart Insights
              </CardTitle>
              <Badge variant="info">AI-powered</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{insights.freshnessNote}</p>
          </div>
          <div className="text-sm text-slate-500" suppressHydrationWarning>
            Last updated {formatDateTimeInTimeZone(insights.generatedAt)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Summary</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{insights.summary}</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-slate-900">Recommended Actions</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{insights.recommendations.length} items</Badge>
              </div>
            </summary>
            <div className="space-y-3 border-t border-slate-200 px-4 py-4">
              {insights.recommendations.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No specific next-step recommendations were generated from the current account data.
                </div>
              ) : (
                insights.recommendations.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-700">{item.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                        <Badge variant="outline">{item.category}</Badge>
                      </div>
                    </div>
                    {item.reasoning?.length ? (
                      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <summary className="cursor-pointer font-medium text-slate-700">Why this insight?</summary>
                        <ul className="mt-2 space-y-1">
                          {item.reasoning.map((reason, index) => (
                            <li key={`${item.id}-reason-${index}`}>{reason}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {item.actionHref && item.actionLabel ? (
                      <div className="mt-3">
                        <Link href={item.actionHref}>
                          <Button variant="outline" size="sm">{item.actionLabel}</Button>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm font-semibold text-slate-900">Missing Info / Alerts</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{insights.alerts.length} items</Badge>
              </div>
            </summary>
            <div className="space-y-3 border-t border-slate-200 px-4 py-4">
              {insights.alerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  No major account data gaps were flagged from the current record.
                </div>
              ) : (
                insights.alerts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-700">{item.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                        <Badge variant="outline">{item.category}</Badge>
                      </div>
                    </div>
                    {item.reasoning?.length ? (
                      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <summary className="cursor-pointer font-medium text-slate-700">Why this insight?</summary>
                        <ul className="mt-2 space-y-1">
                          {item.reasoning.map((reason, index) => (
                            <li key={`${item.id}-reason-${index}`}>{reason}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {item.actionHref && item.actionLabel ? (
                      <div className="mt-3">
                        <Link href={item.actionHref}>
                          <Button variant="outline" size="sm">{item.actionLabel}</Button>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </details>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <Clock3 className="h-4 w-4 text-slate-400" />
          <span suppressHydrationWarning>
            Source snapshot {formatDateTimeInTimeZone(insights.sourceSnapshotAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
