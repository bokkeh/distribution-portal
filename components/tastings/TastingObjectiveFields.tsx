'use client'

import { useEffect, useId, useState, useTransition } from 'react'
import { AlertTriangle, CalendarCheck, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getTastingDecisionForAccount, type SerializedTastingDecision } from '@/actions/tasting-economics'
import { DECISION_META, OBJECTIVE_META, fmtMoney, fmtPercent } from '@/lib/pull-through/display'
import type { TastingObjective } from '@/lib/pull-through/types'
import { goalIsMeasurable } from '@/lib/tastings/objective'

const OBJECTIVE_ORDER: TastingObjective[] = ['sell_through', 'reorder', 'account_opening', 'strategic']

const GOAL_EXAMPLES: Record<TastingObjective, string> = {
  sell_through: 'e.g. Sell 8 bottles, or move inventory below 3 bottles remaining',
  reorder: 'e.g. Deplete 1 case and generate a reorder within 14 days',
  account_opening: 'e.g. Support the launch — 6 bottles sold and a second order within 30 days',
  strategic: 'e.g. Secure distributor follow-up, or generate 10 qualified account leads',
}

function DecisionFact({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-white/70 bg-white/70 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

/**
 * Objective, measurable goal, targets and cost for a tasting being scheduled, plus the
 * account's "should we schedule another tasting?" verdict. A Not Recommended verdict
 * has to be acknowledged before the form can be submitted.
 */
export function TastingObjectiveFields({
  accountId,
  defaultTastingCost,
  tasterPayHint,
}: {
  accountId: string | null
  defaultTastingCost: number
  tasterPayHint?: number | null
}) {
  const formId = useId()
  const [objective, setObjective] = useState<TastingObjective | ''>('')
  const [goal, setGoal] = useState('')
  // Keyed by account so a stale verdict never shows for a newly selected store.
  const [lookup, setLookup] = useState<{ accountId: string; decision: SerializedTastingDecision | null; error: string | null } | null>(null)
  const [acknowledgedFor, setAcknowledgedFor] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!accountId) return
    startTransition(async () => {
      const result = await getTastingDecisionForAccount(accountId)
      setLookup('error' in result ? { accountId, decision: null, error: result.error } : { accountId, decision: result, error: null })
    })
  }, [accountId])

  const current = lookup && lookup.accountId === accountId ? lookup : null
  const decision = current?.decision ?? null
  const decisionError = current?.error ?? null
  const acknowledged = acknowledgedFor === accountId

  const goalOk = goalIsMeasurable(goal)
  const meta = decision ? DECISION_META[decision.kind] : null
  const needsAck = decision?.requiresAcknowledgement ?? false

  return (
    <div className="space-y-4">
      {/* Decision panel */}
      {accountId && (
        <div className={`rounded-xl border p-4 ${meta?.panel ?? 'border-slate-200 bg-slate-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarCheck className="h-4 w-4" />
              Should we schedule another tasting here?
            </p>
            {isPending ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking account economics…
              </span>
            ) : meta ? (
              <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${meta.chip}`}>{meta.label}</span>
            ) : null}
          </div>

          {decisionError && <p className="mt-2 text-sm text-rose-700">{decisionError}</p>}

          {decision && (
            <>
              <p className="mt-2 text-sm font-medium text-slate-800">{decision.headline}</p>
              <ul className="mt-1 space-y-0.5">
                {decision.detail.map((line) => (
                  <li key={line} className="text-sm text-slate-700">
                    • {line}
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <DecisionFact label="Inventory" value={decision.facts.currentInventoryBottles == null ? 'Unknown' : `${Math.round(decision.facts.currentInventoryBottles)} btl`} />
                <DecisionFact label="Last order" value={decision.facts.lastOrderAt ? new Date(decision.facts.lastOrderAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None'} />
                <DecisionFact label="Last tasting" value={decision.facts.lastTastingAt ? `${new Date(decision.facts.lastTastingAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${decision.facts.lastTastingCost != null ? ` · ${fmtMoney(decision.facts.lastTastingCost)}` : ''}` : 'None'} />
                <DecisionFact label="Tastings, 90d" value={String(decision.facts.tastingsLast90Days)} />
                <DecisionFact label="Organic velocity" value={decision.facts.organicPercent == null ? '—' : fmtPercent(decision.facts.organicPercent)} tone="text-emerald-700" />
                <DecisionFact label="Tasting dependency" value={decision.facts.dependencyPercent == null ? '—' : fmtPercent(decision.facts.dependencyPercent)} tone="text-violet-700" />
                <DecisionFact label="Lifetime contribution" value={fmtMoney(decision.facts.lifetimeContribution)} />
                <DecisionFact label="Net after tastings" value={fmtMoney(decision.facts.netContribution)} tone={decision.facts.netContribution < 0 ? 'text-rose-700' : 'text-emerald-700'} />
              </div>

              {needsAck && (
                <label className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-rose-900">
                  <input
                    type="checkbox"
                    name="decisionAcknowledged"
                    value="on"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledgedFor(event.target.checked ? accountId : null)}
                    required
                    className="mt-0.5 accent-rose-600"
                  />
                  <span>
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />I understand this account is currently costing Wisher more in tasting
                    support than it returns, and this tasting has a specific incremental purpose.
                  </span>
                </label>
              )}
              <input type="hidden" name="decisionAtScheduling" value={decision.kind} />
            </>
          )}
        </div>
      )}

      {/* Objective */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-objective`}>Tasting Objective *</Label>
        <select
          id={`${formId}-objective`}
          name="objective"
          required
          value={objective}
          onChange={(event) => setObjective(event.target.value as TastingObjective | '')}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Why is this tasting happening?</option>
          {OBJECTIVE_ORDER.map((key) => (
            <option key={key} value={key}>
              {OBJECTIVE_META[key].label} — {OBJECTIVE_META[key].purpose}
            </option>
          ))}
        </select>
      </div>

      {/* Goal */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-primaryGoal`}>Primary Goal * <span className="font-normal text-slate-500">(must be measurable)</span></Label>
        <Input
          id={`${formId}-primaryGoal`}
          name="primaryGoal"
          required
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder={objective ? GOAL_EXAMPLES[objective] : 'e.g. Sell 8 bottles, deplete 1 case, generate a reorder'}
          aria-invalid={goal.length > 0 && !goalOk}
          className={goal.length > 0 && !goalOk ? 'border-rose-400' : ''}
        />
        {goal.length > 0 && !goalOk && (
          <p className="text-xs text-rose-700">
            &quot;Brand awareness&quot; on its own is not a goal. Add a measurable outcome — a bottle count, a case, a reorder, a follow-up.
          </p>
        )}
      </div>

      {/* Targets by objective */}
      {objective && objective !== 'strategic' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-targetBottlesSold`}>Target bottles sold</Label>
            <Input id={`${formId}-targetBottlesSold`} name="targetBottlesSold" type="number" min={0} step={1} placeholder="8" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-targetCasesDepleted`}>Target cases depleted</Label>
            <Input id={`${formId}-targetCasesDepleted`} name="targetCasesDepleted" type="number" min={0} step={0.25} placeholder="1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-targetReorderQuantity`}>Target reorder (cases)</Label>
            <Input id={`${formId}-targetReorderQuantity`} name="targetReorderQuantity" type="number" min={0} step={1} placeholder={objective === 'reorder' ? '1' : ''} />
          </div>
        </div>
      )}

      {objective === 'strategic' && (
        <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Strategic tasting — reported separately from retail economics</p>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-strategicReason`}>Strategic reason *</Label>
            <Input id={`${formId}-strategicReason`} name="strategicReason" required placeholder="High-value venue, influencer event, press, distributor relationship, industry event, partnership" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-expectedOutcome`}>Expected outcome *</Label>
              <Input id={`${formId}-expectedOutcome`} name="expectedOutcome" required placeholder="e.g. Distributor agrees to a spring listing" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-estimatedValue`}>Estimated value / opportunity ($) *</Label>
              <Input id={`${formId}-estimatedValue`} name="estimatedValue" type="number" min={0} step={1} required placeholder="2500" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-followUpAction`}>Follow-up action *</Label>
            <Input id={`${formId}-followUpAction`} name="followUpAction" required placeholder="e.g. Call buyer within 3 days with pricing sheet" />
          </div>
        </div>
      )}

      {/* Cost */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-estimatedCost`}>Estimated tasting cost ($)</Label>
          <Input id={`${formId}-estimatedCost`} name="estimatedCost" type="number" min={0} step={1} placeholder={String(defaultTastingCost)} />
          <p className="text-[11px] text-slate-500">Blank uses the ${defaultTastingCost} default until the taster invoice arrives.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-tasterPay`}>Taster pay ($)</Label>
          <Input id={`${formId}-tasterPay`} name="tasterPay" type="number" min={0} step={1} placeholder={tasterPayHint != null ? String(tasterPayHint) : ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-expectedRoi`}>Expected ROI</Label>
          <Input id={`${formId}-expectedRoi`} name="expectedRoi" placeholder="e.g. 1 case now, 2 organic within 60 days" />
        </div>
      </div>
    </div>
  )
}
