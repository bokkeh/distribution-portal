'use client'

import { useState, useTransition } from 'react'
import { Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateTastingEconomicsSettings } from '@/actions/tasting-economics'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TastingEconomicsSettings } from '@/lib/pull-through/types'

/**
 * Global economics assumptions. Every ROI, dependency and health figure reads these,
 * so a change here re-prices the whole book on the next page load — nothing is cached.
 */
export function EconomicsSettingsCard({ settings, canEdit }: { settings: TastingEconomicsSettings; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-slate-500" />
            Assumptions
          </CardTitle>
          {canEdit && !open && (
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              Edit assumptions
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Used everywhere: contribution per case × cases, tasting cost from invoice → per-tasting estimate → this default.
          Change them here and every account re-prices; individual tastings can still carry their own estimate.
        </p>
      </CardHeader>
      <CardContent>
        {!open ? (
          <dl className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Contribution per case</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">${settings.contributionPerCase}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Typical tasting cost</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">${settings.defaultTastingCost}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Attribution window</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{settings.attributionWindowDays} days</dd>
              <dd className="text-[11px] text-muted-foreground">Reorder inside this window after a tasting = assisted</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assisted sales share</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{Math.round(settings.assistedSalesShare * 100)}%</dd>
              <dd className="text-[11px] text-muted-foreground">Of the prior order sold at the tasting, up to 45 days</dd>
            </div>
          </dl>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              startTransition(async () => {
                const result = await updateTastingEconomicsSettings(formData)
                if ('error' in result && result.error) {
                  toast.error('Not saved', { description: result.error })
                  return
                }
                toast.success('Assumptions updated', { description: 'Every account has been re-priced.' })
                setOpen(false)
              })
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="contributionPerCase">Contribution per case ($)</Label>
              <Input id="contributionPerCase" name="contributionPerCase" type="number" min={0} step={1} defaultValue={settings.contributionPerCase} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="defaultTastingCost">Typical tasting cost ($)</Label>
              <Input id="defaultTastingCost" name="defaultTastingCost" type="number" min={0} step={1} defaultValue={settings.defaultTastingCost} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attributionWindowDays">Attribution window (days)</Label>
              <Input id="attributionWindowDays" name="attributionWindowDays" type="number" min={1} max={90} step={1} defaultValue={settings.attributionWindowDays} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assistedSalesSharePercent">Assisted sales share (%)</Label>
              <Input id="assistedSalesSharePercent" name="assistedSalesSharePercent" type="number" min={0} max={100} step={5} defaultValue={Math.round(settings.assistedSalesShare * 100)} required />
            </div>
            <div className="flex gap-2 sm:col-span-4">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
