'use client'

import { useState, useTransition } from 'react'
import { analyzeShelfImages, updateShelfAnalysisOverrides } from '@/actions/shelf-analysis'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  Eye,
  Package,
  Tag,
  LayoutGrid,
  ShieldX,
  CheckCircle2,
  Pencil,
  Check,
  X,
} from 'lucide-react'

// Serialized shape from server (dates become strings over the wire)
export type SerializedShelfAnalysis = {
  id: string
  deliveryStopId: string
  customerId: string | null
  imageUrls: string[]
  status: string
  confidence: string | null
  summary: string | null
  wisherDetected: boolean | null
  shelfLevel: string | null
  horizontalPosition: string | null
  facings: number | null
  labelForward: boolean | null
  obstructionDetected: boolean | null
  detectedPrice: string | null
  promoDetected: boolean | null
  stockLevel: string | null
  competitors: unknown
  placementScore: number | null
  visibilityScore: number | null
  facingScore: number | null
  overallScore: number | null
  insights: unknown
  recommendations: unknown
  trend: string | null
  trendNotes: string | null
  errorMessage: string | null
  userOverrides: unknown
  createdAt: string | Date
}

type StopData = {
  id: string
  shelfPhotoUrl: string | null
  additionalPhotoUrl: string | null
  companyName: string | null
  address: string
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 45) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBg(score: number | null | undefined) {
  if (score == null) return 'bg-slate-50 border-slate-200'
  if (score >= 70) return 'bg-emerald-50 border-emerald-200'
  if (score >= 45) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function formatLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

type Overrides = {
  shelfLevel?: string
  facings?: number | null
  detectedPrice?: string | null
  promoDetected?: boolean | null
  stockLevel?: string
  visibilityScore?: number | null
}

export function ShelfInsightsCard({
  stop,
  existingAnalysis,
}: {
  stop: StopData
  existingAnalysis: SerializedShelfAnalysis | null
}) {
  const [analysis, setAnalysis] = useState<SerializedShelfAnalysis | null>(existingAnalysis)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Overrides>({})

  const hasPhotos = !!(stop.shelfPhotoUrl || stop.additionalPhotoUrl)
  if (!hasPhotos) return null

  function handleAnalyze() {
    setError(null)
    startTransition(async () => {
      const result = await analyzeShelfImages(stop.id)
      if ('error' in result) {
        setError(result.error)
      } else {
        setAnalysis(result as unknown as SerializedShelfAnalysis)
      }
    })
  }

  function startEdit() {
    if (!analysis) return
    const ov = (analysis.userOverrides ?? {}) as Overrides
    setDraft({
      shelfLevel: ov.shelfLevel ?? analysis.shelfLevel ?? '',
      facings: ov.facings !== undefined ? ov.facings : analysis.facings,
      detectedPrice: ov.detectedPrice !== undefined ? ov.detectedPrice : analysis.detectedPrice,
      promoDetected: ov.promoDetected !== undefined ? ov.promoDetected : analysis.promoDetected,
      stockLevel: ov.stockLevel ?? analysis.stockLevel ?? '',
      visibilityScore: ov.visibilityScore !== undefined ? ov.visibilityScore : analysis.visibilityScore,
    })
    setSaveError(null)
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setSaveError(null)
  }

  function handleSave() {
    if (!analysis) return
    setSaveError(null)
    startTransition(async () => {
      const result = await updateShelfAnalysisOverrides(analysis.id, draft)
      if ('error' in result) {
        setSaveError(result.error)
      } else {
        setAnalysis({ ...analysis, userOverrides: { ...(analysis.userOverrides as object ?? {}), ...draft } })
        setIsEditing(false)
      }
    })
  }

  // --- Empty / trigger state ---
  if (!analysis && !isPending && !error) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">AI Shelf Insights</p>
            <p className="text-xs text-muted-foreground">Analyze shelf photos for brand intelligence</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleAnalyze} className="shrink-0">
          Analyze
        </Button>
      </div>
    )
  }

  // --- Loading state ---
  if (isPending && !isEditing) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-violet-900">Analyzing shelf images…</p>
          <p className="text-xs text-violet-600">GPT-4o reviewing placement, facings, competitors &amp; visibility</p>
        </div>
      </div>
    )
  }

  // --- Error state ---
  if (error || analysis?.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error ?? analysis?.errorMessage ?? 'Analysis failed.'}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleAnalyze} className="shrink-0">
          <RefreshCw className="mr-1 h-3 w-3" />Retry
        </Button>
      </div>
    )
  }

  if (!analysis) return null

  const a = analysis
  const ov = (a.userOverrides ?? {}) as Overrides
  const insights = (a.insights ?? {}) as Record<string, string>
  const recommendations = (a.recommendations ?? []) as string[]
  const competitors = (a.competitors ?? []) as string[]
  const createdAtStr = typeof a.createdAt === 'string'
    ? new Date(a.createdAt).toLocaleString()
    : a.createdAt instanceof Date ? a.createdAt.toLocaleString() : ''

  // Resolved values: override takes precedence over AI
  const resolved = {
    shelfLevel: ov.shelfLevel ?? a.shelfLevel,
    facings: ov.facings !== undefined ? ov.facings : a.facings,
    detectedPrice: ov.detectedPrice !== undefined ? ov.detectedPrice : a.detectedPrice,
    promoDetected: ov.promoDetected !== undefined ? ov.promoDetected : a.promoDetected,
    stockLevel: ov.stockLevel ?? a.stockLevel,
    visibilityScore: ov.visibilityScore !== undefined ? ov.visibilityScore : a.visibilityScore,
  }
  const hasAnyOverride = Object.keys(ov).length > 0

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-slate-50 px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <p className="text-sm font-semibold text-slate-900">AI Shelf Insights</p>
          <Badge
            variant={a.status === 'complete' ? 'success' : 'secondary'}
            className="text-[10px] px-1.5 py-0"
          >
            {a.status}
          </Badge>
          {a.confidence && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {a.confidence} confidence
            </Badge>
          )}
          {hasAnyOverride && !isEditing && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
              human-corrected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600 hover:text-red-700" onClick={cancelEdit} disabled={isPending}>
                <X className="mr-1 h-3 w-3" />Cancel
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave} disabled={isPending}>
                <Check className="mr-1 h-3 w-3" />{isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={startEdit}>
                <Pencil className="mr-1 h-3 w-3" />Edit
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={handleAnalyze} disabled={isPending}>
                <RefreshCw className="mr-1 h-3 w-3" />Re-analyze
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {saveError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {/* Wisher not detected banner */}
        {a.wisherDetected === false && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <ShieldX className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              Wisher Vodka was not detected in these images
            </p>
          </div>
        )}
        {a.wisherDetected === true && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">Wisher Vodka detected on shelf</p>
          </div>
        )}

        {/* Summary */}
        {a.summary && (
          <p className="text-sm leading-relaxed text-slate-700">{a.summary}</p>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {/* Shelf Level */}
          <MetricCell
            label="Shelf Level"
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            isEditing={isEditing}
            isOverridden={!!ov.shelfLevel}
            displayValue={resolved.shelfLevel?.replace(/_/g, ' ') ?? '—'}
            score={null}
          >
            <select
              value={draft.shelfLevel ?? ''}
              onChange={e => setDraft(d => ({ ...d, shelfLevel: e.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
            >
              <option value="">—</option>
              {['top', 'eye', 'mid', 'bottom', 'unknown'].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </MetricCell>

          {/* Facings */}
          <MetricCell
            label="Facings"
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            isEditing={isEditing}
            isOverridden={ov.facings !== undefined}
            displayValue={resolved.facings != null ? String(resolved.facings) : '—'}
            score={a.facingScore}
          >
            <input
              type="number"
              min={0}
              value={draft.facings ?? ''}
              onChange={e => setDraft(d => ({ ...d, facings: e.target.value === '' ? null : Number(e.target.value) }))}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
            />
          </MetricCell>

          {/* Visibility */}
          <MetricCell
            label="Visibility"
            icon={<Eye className="h-3.5 w-3.5" />}
            isEditing={isEditing}
            isOverridden={ov.visibilityScore !== undefined}
            displayValue={resolved.visibilityScore != null ? String(resolved.visibilityScore) : '—'}
            score={resolved.visibilityScore}
          >
            <input
              type="number"
              min={0}
              max={100}
              value={draft.visibilityScore ?? ''}
              onChange={e => setDraft(d => ({ ...d, visibilityScore: e.target.value === '' ? null : Number(e.target.value) }))}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
            />
          </MetricCell>

          {/* Price */}
          <MetricCell
            label="Price"
            icon={<Tag className="h-3.5 w-3.5" />}
            isEditing={isEditing}
            isOverridden={ov.detectedPrice !== undefined}
            displayValue={resolved.detectedPrice ?? 'Not detected'}
            score={null}
          >
            <input
              type="text"
              placeholder="$0.00"
              value={draft.detectedPrice ?? ''}
              onChange={e => setDraft(d => ({ ...d, detectedPrice: e.target.value || null }))}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
            />
          </MetricCell>

          {/* Promo */}
          <MetricCell
            label="Promo"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            isEditing={isEditing}
            isOverridden={ov.promoDetected !== undefined}
            displayValue={resolved.promoDetected === true ? 'Yes' : resolved.promoDetected === false ? 'None' : '—'}
            score={null}
          >
            <select
              value={draft.promoDetected === null || draft.promoDetected === undefined ? '' : String(draft.promoDetected)}
              onChange={e => setDraft(d => ({ ...d, promoDetected: e.target.value === '' ? null : e.target.value === 'true' }))}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
            >
              <option value="">—</option>
              <option value="true">Yes</option>
              <option value="false">None</option>
            </select>
          </MetricCell>

          {/* Stock */}
          <MetricCell
            label="Stock"
            icon={<Package className="h-3.5 w-3.5" />}
            isEditing={isEditing}
            isOverridden={!!ov.stockLevel}
            displayValue={resolved.stockLevel?.replace(/_/g, ' ') ?? '—'}
            score={null}
          >
            <select
              value={draft.stockLevel ?? ''}
              onChange={e => setDraft(d => ({ ...d, stockLevel: e.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
            >
              <option value="">—</option>
              {['full', 'medium', 'low', 'nearly_empty', 'unknown'].map(v => (
                <option key={v} value={v}>{v.replace('_', ' ')}</option>
              ))}
            </select>
          </MetricCell>
        </div>

        {/* Overall score bar */}
        {a.overallScore != null && (
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">Overall</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  a.overallScore >= 70 ? 'bg-emerald-500' : a.overallScore >= 45 ? 'bg-amber-500' : 'bg-red-500',
                )}
                style={{ width: `${a.overallScore}%` }}
              />
            </div>
            <span className={cn('shrink-0 text-sm font-bold', scoreColor(a.overallScore))}>
              {a.overallScore}/100
            </span>
          </div>
        )}

        {/* Trend vs prior visit */}
        {a.trend && a.trend !== 'no_prior_data' && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2.5',
              a.trend === 'improving'
                ? 'border-emerald-200 bg-emerald-50'
                : a.trend === 'declining'
                ? 'border-red-200 bg-red-50'
                : 'border-slate-200 bg-slate-50',
            )}
          >
            {a.trend === 'improving' ? (
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : a.trend === 'declining' ? (
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            ) : (
              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            )}
            <div>
              <p
                className={cn(
                  'text-xs font-semibold capitalize',
                  a.trend === 'improving'
                    ? 'text-emerald-700'
                    : a.trend === 'declining'
                    ? 'text-red-700'
                    : 'text-slate-600',
                )}
              >
                {a.trend} vs prior visit
              </p>
              {a.trendNotes && (
                <p className="mt-0.5 text-xs text-muted-foreground">{a.trendNotes}</p>
              )}
            </div>
          </div>
        )}
        {a.trend === 'no_prior_data' && (
          <p className="text-xs italic text-muted-foreground">
            No prior visit data for this store — trend will appear after the next analysis.
          </p>
        )}

        {/* Competitors nearby */}
        {competitors.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Competitors Nearby
            </p>
            <div className="flex flex-wrap gap-1.5">
              {competitors.map(c => (
                <span
                  key={c}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key insights */}
        {Object.keys(insights).length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Key Insights
            </p>
            <div className="space-y-1.5">
              {Object.entries(insights)
                .filter(([, v]) => v && v !== 'null')
                .map(([k, v]) => {
                  let display = v
                  if (k === 'pricing' && ov.detectedPrice) {
                    display = v.replace(/\$[\d,.]+/, ov.detectedPrice)
                    if (display === v) display = `Wisher Vodka is priced at ${ov.detectedPrice}.`
                  }
                  return (
                    <div key={k} className="flex gap-2 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground">{formatLabel(k)}:</span>
                      <span className="text-slate-700">
                        {display}
                        {k === 'pricing' && ov.detectedPrice && (
                          <span className="ml-1.5 text-[10px] text-amber-600 font-medium">(corrected)</span>
                        )}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Recommended actions */}
        {recommendations.length > 0 && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              Recommended Actions
            </p>
            <ul className="space-y-1.5">
              {recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-violet-900">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold text-violet-700">
                    {i + 1}
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          AI analysis by GPT-4o · {createdAtStr} · Insights are AI-generated estimates based on image content only
        </p>
      </div>
    </div>
  )
}

function MetricCell({
  label,
  icon,
  isEditing,
  isOverridden,
  displayValue,
  score,
  children,
}: {
  label: string
  icon: React.ReactNode
  isEditing: boolean
  isOverridden: boolean
  displayValue: string
  score: number | null | undefined
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        isEditing ? 'border-violet-300 bg-violet-50/50' : score != null ? scoreBg(score) : 'border-slate-200 bg-slate-50',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {isOverridden && !isEditing && (
          <span title="Human-corrected" className="text-amber-500">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      {isEditing ? (
        children
      ) : (
        <p className={cn('text-sm font-semibold capitalize', score != null ? scoreColor(score) : 'text-slate-900')}>
          {displayValue}
        </p>
      )}
    </div>
  )
}
