import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DriverWorkspaceData } from '@/lib/driver/deliveries'
import { formatDate } from '@/lib/utils'

export function DriverWorkspaceHero({
  workspace,
  title = 'Driver Dashboard',
  description = 'Track route progress, capture proof, and keep each stop moving without jumping between pages.',
}: {
  workspace: DriverWorkspaceData
  title?: string
  description?: string
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-sm">
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
            <span>Driver Workspace</span>
            {workspace.activeDelivery ? <Badge variant="info" className="border border-blue-200 bg-blue-50 text-blue-700">Active route ready</Badge> : null}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Assigned runs</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{workspace.deliveryCards.length}</p>
              <p className="mt-1 text-xs text-slate-500">Scheduled or in progress</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Stops completed</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{workspace.deliveredStops}/{workspace.totalStops}</p>
              <p className="mt-1 text-xs text-slate-500">{workspace.failedStops > 0 ? `${workspace.failedStops} failed stop${workspace.failedStops === 1 ? '' : 's'}` : 'No failed stops'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Route coverage</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{workspace.totalStops > 0 ? `${Math.round((workspace.mappedStops / workspace.totalStops) * 100)}%` : '0%'}</p>
              <p className="mt-1 text-xs text-slate-500">{workspace.mappedStops}/{workspace.totalStops} stops mapped</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/driver/deliveries#current-deliveries">
              <Button variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50">Current Deliveries</Button>
            </Link>
            <Link href="/driver/deliveries#past-deliveries">
              <Button variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50">Past Deliveries</Button>
            </Link>
            <Link href="/driver/map">
              <Button variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50">Open Full Map</Button>
            </Link>
            <Link href="/driver/profile">
              <Button variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50">Review Profile</Button>
            </Link>
          </div>
        </div>

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">Dispatch Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Next priority stop</p>
              {workspace.activeDelivery?.nextStop ? (
                <>
                  <p className="mt-2 font-semibold text-slate-900">{workspace.activeDelivery.nextStop.companyName ?? workspace.activeDelivery.nextStop.address}</p>
                  <p className="mt-1 text-sm text-slate-600">{workspace.activeDelivery.nextStop.address}</p>
                  <p className="mt-2 text-xs text-slate-500">Run date: {formatDate(workspace.activeDelivery.weekStartDate)}</p>
                </>
              ) : (
                <p className="mt-2 text-slate-600">No pending stops. You&apos;re clear for now.</p>
              )}
            </div>
            <div className="space-y-2">
              {workspace.prepChecklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <div className={`mt-0.5 rounded-full p-1 ${item.ready ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {item.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
