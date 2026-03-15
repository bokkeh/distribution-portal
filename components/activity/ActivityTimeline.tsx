import { formatDate } from '@/lib/utils'
import type { TimelineItem } from '@/lib/activity/read'

export function ActivityTimeline({
  items,
  title = 'Activity Timeline',
}: {
  items: TimelineItem[]
  title?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">{items.length} events</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="relative pl-5">
              <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400" suppressHydrationWarning>
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                {item.body ? <p className="mt-1 text-sm text-slate-600">{item.body}</p> : null}
                {item.actorName ? <p className="mt-2 text-xs text-slate-500">By {item.actorName}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
