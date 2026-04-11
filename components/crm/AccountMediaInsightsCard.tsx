'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, Clock3, RefreshCw, Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { analyzeAccountMedia, type AccountMediaInsights } from '@/actions/account-media-insights'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function conditionVariant(condition: AccountMediaInsights['accountCondition']) {
  if (condition === 'improving') return 'success'
  if (condition === 'declining') return 'destructive'
  if (condition === 'mixed') return 'warning'
  return 'secondary'
}

function TrendIcon({ condition }: { condition: AccountMediaInsights['accountCondition'] }) {
  if (condition === 'improving') return <TrendingUp className="h-4 w-4 text-emerald-600" />
  if (condition === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />
  return <Minus className="h-4 w-4 text-slate-500" />
}

export function AccountMediaInsightsCard({ accountId }: { accountId: string }) {
  const [analysis, setAnalysis] = useState<AccountMediaInsights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAnalyze() {
    setError(null)
    startTransition(async () => {
      const result = await analyzeAccountMedia(accountId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setAnalysis(result)
    })
  }

  if (!analysis && !error && !isPending) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
          <div>
            <p className="text-sm font-medium text-slate-700">AI Media Insights</p>
            <p className="text-xs text-muted-foreground">Review account images over time for recent conditions, trends, risks, and opportunities.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleAnalyze} className="shrink-0">
          Analyze
        </Button>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-violet-900">Analyzing account media…</p>
          <p className="text-xs text-violet-600">GPT-4o is reviewing recent media and multi-month account changes.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleAnalyze} className="shrink-0">
          <RefreshCw className="mr-1 h-3 w-3" />Retry
        </Button>
      </div>
    )
  }

  if (!analysis) return null

  const analyzedAt = new Date(analysis.analyzedAt).toLocaleString()

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-slate-50 px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
          <p className="text-sm font-semibold text-slate-900">AI Media Insights</p>
          <Badge variant="info" className="text-[10px] px-1.5 py-0">GPT-4o</Badge>
          <Badge variant={conditionVariant(analysis.accountCondition)} className="text-[10px] px-1.5 py-0 capitalize">
            {analysis.accountCondition.replaceAll('_', ' ')}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-muted-foreground" onClick={handleAnalyze}>
          <RefreshCw className="mr-1 h-3 w-3" />Re-analyze
        </Button>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Summary</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{analysis.summary}</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Recent View</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{analysis.recentInsight}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <TrendIcon condition={analysis.accountCondition} />
              <p className="text-sm font-semibold text-slate-900">Trend Over Time</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{analysis.trendInsight}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Opportunities</p>
            <ul className="mt-3 space-y-2 text-sm text-emerald-900">
              {analysis.opportunities.length === 0 ? <li>No clear opportunities flagged.</li> : analysis.opportunities.map((item, index) => <li key={`opp-${index}`}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Risks</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {analysis.risks.length === 0 ? <li>No clear risks flagged.</li> : analysis.risks.map((item, index) => <li key={`risk-${index}`}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Recommended Actions</p>
            <ul className="mt-3 space-y-2 text-sm text-blue-900">
              {analysis.recommendations.length === 0 ? <li>No recommendations generated.</li> : analysis.recommendations.map((item, index) => <li key={`rec-${index}`}>{item}</li>)}
            </ul>
          </div>
        </div>

        {analysis.evidenceTimeline.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Evidence Timeline</p>
            <div className="mt-3 space-y-2">
              {analysis.evidenceTimeline.map((item, index) => (
                <div key={`timeline-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.period}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.observation}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-slate-400" />
            <span>Analyzed {analyzedAt}</span>
          </div>
          <span>{analysis.mediaCount} media items reviewed</span>
          <span>{analysis.imageCount} visual assets analyzed</span>
          <span>{analysis.recentMediaCount} recent items weighted heavily</span>
        </div>
      </div>
    </div>
  )
}
