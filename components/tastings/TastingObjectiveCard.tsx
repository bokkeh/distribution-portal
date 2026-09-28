'use client'

import { useState } from 'react'
import { Target } from 'lucide-react'
import { updateTastingObjective } from '@/actions/tastings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OBJECTIVE_META, fmtMoney } from '@/lib/pull-through/display'
import type { TastingObjective } from '@/lib/pull-through/types'
import { goalIsMeasurable } from '@/lib/tastings/objective'

const OBJECTIVE_ORDER: TastingObjective[] = ['sell_through', 'reorder', 'account_opening', 'strategic']

export type TastingObjectiveValues = {
  objective: TastingObjective | null
  primaryGoal: string | null
  targetBottlesSold: number | null
  targetCasesDepleted: number | null
  targetReorderQuantity: number | null
  estimatedCost: number | null
  tasterPay: number | null
  expectedRoi: string | null
  strategicReason: string | null
  expectedOutcome: string | null
  estimatedValue: number | null
  followUpAction: string | null
  resultAfterEvent: string | null
  decisionAtScheduling: string | null
}

/**
 * Objective and goal for an existing tasting. Read-only summary with an inline editor,
 * so rep-requested tastings and older ones can be given an objective after the fact.
 */
export function TastingObjectiveCard({
  tastingId,
  values,
  defaultTastingCost,
  redirectTo,
}: {
  tastingId: string
  values: TastingObjectiveValues
  defaultTastingCost: number
  redirectTo?: string
}) {
  const [editing, setEditing] = useState(values.objective == null)
  const [objective, setObjective] = useState<TastingObjective | ''>(values.objective ?? '')
  const [goal, setGoal] = useState(values.primaryGoal ?? '')
  const meta = values.objective ? OBJECTIVE_META[values.objective] : null
  const goalOk = goalIsMeasurable(goal)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Target className="h-4 w-4 text-slate-400" />
            Objective &amp; Goal
          </CardTitle>
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!editing && meta ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="text-xs text-slate-400">Objective</span>
                <p className="font-medium">{meta.label}</p>
                <p className="text-xs text-slate-500">{meta.purpose}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Primary goal</span>
                <p className="font-medium">{values.primaryGoal}</p>
              </div>
              {values.objective !== 'strategic' && (
                <>
                  <div>
                    <span className="text-xs text-slate-400">Targets</span>
                    <p className="font-medium">
                      {[
                        values.targetBottlesSold != null ? `${values.targetBottlesSold} bottles sold` : null,
                        values.targetCasesDepleted != null ? `${values.targetCasesDepleted} cases depleted` : null,
                        values.targetReorderQuantity != null ? `reorder of ${values.targetReorderQuantity} case${values.targetReorderQuantity === 1 ? '' : 's'}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'None set'}
                    </p>
                  </div>
                </>
              )}
              <div>
                <span className="text-xs text-slate-400">Cost</span>
                <p className="font-medium">
                  {values.estimatedCost != null ? `${fmtMoney(values.estimatedCost)} estimated` : `${fmtMoney(defaultTastingCost)} default`}
                  {values.tasterPay != null ? ` · taster pay ${fmtMoney(values.tasterPay)}` : ''}
                </p>
                {values.expectedRoi && <p className="text-xs text-slate-500">Expected ROI: {values.expectedRoi}</p>}
              </div>
              {values.decisionAtScheduling && (
                <div>
                  <span className="text-xs text-slate-400">Verdict at scheduling</span>
                  <p className="font-medium capitalize">{values.decisionAtScheduling.replace('_', ' ')}</p>
                </div>
              )}
            </div>
            {values.objective === 'strategic' && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Strategic tasting</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-400">Reason</dt><dd className="font-medium">{values.strategicReason}</dd></div>
                  <div><dt className="text-xs text-slate-400">Expected outcome</dt><dd className="font-medium">{values.expectedOutcome}</dd></div>
                  <div><dt className="text-xs text-slate-400">Estimated value</dt><dd className="font-medium">{fmtMoney(values.estimatedValue)}</dd></div>
                  <div><dt className="text-xs text-slate-400">Follow-up action</dt><dd className="font-medium">{values.followUpAction}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-400">Result after event</dt><dd className="font-medium">{values.resultAfterEvent ?? <span className="text-amber-600">Not recorded yet</span>}</dd></div>
                </dl>
              </div>
            )}
          </>
        ) : (
          <form action={updateTastingObjective} className="space-y-4">
            <input type="hidden" name="tastingId" value={tastingId} />
            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
            {values.objective == null && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This tasting has no objective yet, so it is grouped as &quot;No objective set&quot; on the tasting dashboard.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor={`objective-${tastingId}`}>Tasting Objective *</Label>
              <select
                id={`objective-${tastingId}`}
                name="objective"
                required
                value={objective}
                onChange={(event) => setObjective(event.target.value as TastingObjective | '')}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Why is this tasting happening?</option>
                {OBJECTIVE_ORDER.map((key) => (
                  <option key={key} value={key}>{OBJECTIVE_META[key].label} — {OBJECTIVE_META[key].purpose}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`goal-${tastingId}`}>Primary Goal * <span className="font-normal text-slate-500">(measurable)</span></Label>
              <Input id={`goal-${tastingId}`} name="primaryGoal" required value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. Sell 8 bottles and generate a reorder" className={goal.length > 0 && !goalOk ? 'border-rose-400' : ''} />
              {goal.length > 0 && !goalOk && <p className="text-xs text-rose-700">Add a measurable outcome — a bottle count, a case, a reorder, a follow-up.</p>}
            </div>
            {objective && objective !== 'strategic' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label htmlFor={`tb-${tastingId}`}>Target bottles</Label><Input id={`tb-${tastingId}`} name="targetBottlesSold" type="number" min={0} step={1} defaultValue={values.targetBottlesSold ?? ''} /></div>
                <div className="space-y-1"><Label htmlFor={`tc-${tastingId}`}>Target cases depleted</Label><Input id={`tc-${tastingId}`} name="targetCasesDepleted" type="number" min={0} step={0.25} defaultValue={values.targetCasesDepleted ?? ''} /></div>
                <div className="space-y-1"><Label htmlFor={`tr-${tastingId}`}>Target reorder (cases)</Label><Input id={`tr-${tastingId}`} name="targetReorderQuantity" type="number" min={0} step={1} defaultValue={values.targetReorderQuantity ?? ''} /></div>
              </div>
            )}
            {objective === 'strategic' && (
              <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <div className="space-y-1"><Label htmlFor={`sr-${tastingId}`}>Strategic reason *</Label><Input id={`sr-${tastingId}`} name="strategicReason" required defaultValue={values.strategicReason ?? ''} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor={`eo-${tastingId}`}>Expected outcome *</Label><Input id={`eo-${tastingId}`} name="expectedOutcome" required defaultValue={values.expectedOutcome ?? ''} /></div>
                  <div className="space-y-1"><Label htmlFor={`ev-${tastingId}`}>Estimated value ($) *</Label><Input id={`ev-${tastingId}`} name="estimatedValue" type="number" min={0} step={1} required defaultValue={values.estimatedValue ?? ''} /></div>
                </div>
                <div className="space-y-1"><Label htmlFor={`fa-${tastingId}`}>Follow-up action *</Label><Input id={`fa-${tastingId}`} name="followUpAction" required defaultValue={values.followUpAction ?? ''} /></div>
                <div className="space-y-1"><Label htmlFor={`ra-${tastingId}`}>Result after event</Label><Input id={`ra-${tastingId}`} name="resultAfterEvent" defaultValue={values.resultAfterEvent ?? ''} placeholder="What actually came of it" /></div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label htmlFor={`ec-${tastingId}`}>Estimated cost ($)</Label><Input id={`ec-${tastingId}`} name="estimatedCost" type="number" min={0} step={1} defaultValue={values.estimatedCost ?? ''} placeholder={String(defaultTastingCost)} /></div>
              <div className="space-y-1"><Label htmlFor={`tp-${tastingId}`}>Taster pay ($)</Label><Input id={`tp-${tastingId}`} name="tasterPay" type="number" min={0} step={1} defaultValue={values.tasterPay ?? ''} /></div>
              <div className="space-y-1"><Label htmlFor={`er-${tastingId}`}>Expected ROI</Label><Input id={`er-${tastingId}`} name="expectedRoi" defaultValue={values.expectedRoi ?? ''} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Save objective</Button>
              {values.objective != null && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
