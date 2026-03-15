import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { retryScheduledSmsJob } from '@/actions/jobs'

export function JobsOverview({
  rows,
}: {
  rows: Array<{
    id: string
    type: string
    status: string
    target: string
    detail: string
    scheduledFor: Date | null
    completedAt: Date | null
    createdAt: Date
    lastError: string | null
    retryable?: boolean
  }>
}) {
  const counts = rows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {['pending', 'sent', 'failed', 'retrying'].map((status) => (
          <div key={status} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">{status}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{counts[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Background Jobs</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500">No jobs have been recorded yet.</div>
          ) : rows.map((row) => (
            <div key={row.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_auto]">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{row.type}</p>
                  <Badge variant={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'destructive' : row.status === 'retrying' ? 'warning' : 'secondary'}>
                    {row.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{row.detail}</p>
                {row.lastError ? <p className="mt-2 text-xs text-red-600">{row.lastError}</p> : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Target</p>
                <p className="mt-1 text-sm text-slate-700">{row.target}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Scheduled</p>
                <p className="mt-1 text-sm text-slate-700" suppressHydrationWarning>
                  {row.scheduledFor ? formatDate(row.scheduledFor) : 'Immediate'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Completed</p>
                <p className="mt-1 text-sm text-slate-700" suppressHydrationWarning>
                  {row.completedAt ? formatDate(row.completedAt) : formatDate(row.createdAt)}
                </p>
              </div>
              <div className="flex items-start justify-end">
                {row.retryable ? (
                  <form action={retryScheduledSmsJob.bind(null, row.id)}>
                    <Button size="sm" variant="outline" type="submit">Retry</Button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
