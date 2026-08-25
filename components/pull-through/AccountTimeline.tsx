import Link from 'next/link'
import {
  ClipboardCheck,
  MessageSquare,
  Package,
  PhoneCall,
  RefreshCw,
  ShoppingCart,
  Wine,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { TimelineEvent, TimelineEventKind } from '@/lib/pull-through/types'

const KIND_META: Record<TimelineEventKind, { icon: typeof ShoppingCart; chip: string; label: string }> = {
  order: { icon: ShoppingCart, chip: 'bg-blue-50 text-blue-600 border-blue-200', label: 'Order' },
  reorder: { icon: RefreshCw, chip: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Reorder' },
  sample_order: { icon: Package, chip: 'bg-slate-50 text-slate-500 border-slate-200', label: 'Sample' },
  tasting: { icon: Wine, chip: 'bg-violet-50 text-violet-600 border-violet-200', label: 'Tasting' },
  inventory_check: { icon: ClipboardCheck, chip: 'bg-amber-50 text-amber-600 border-amber-200', label: 'Inventory' },
  note: { icon: MessageSquare, chip: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Note' },
  sales_visit: { icon: PhoneCall, chip: 'bg-cyan-50 text-cyan-600 border-cyan-200', label: 'Visit' },
  crm_activity: { icon: PhoneCall, chip: 'bg-slate-50 text-slate-600 border-slate-200', label: 'CRM' },
}

/**
 * Unified account timeline. Every entry is an existing record — orders, tastings,
 * inventory checks, notes, sales visits and CRM activity — merged chronologically and
 * deep-linked back to its source. Nothing here is re-entered by hand.
 */
export function AccountTimeline({ events, limit }: { events: TimelineEvent[]; limit?: number }) {
  const shown = limit ? events.slice(0, limit) : events

  if (shown.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded for this account yet.</p>
  }

  return (
    <ol className="relative space-y-0">
      {shown.map((event, index) => {
        const meta = KIND_META[event.kind]
        const Icon = meta.icon
        const isLast = index === shown.length - 1

        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" aria-hidden />}
            <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${meta.chip}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {formatDate(event.at)}
                </span>
                {event.actorName && <span className="text-xs text-slate-500">· {event.actorName}</span>}
              </div>

              {event.detail && <p className="mt-0.5 text-sm leading-snug text-slate-600">{event.detail}</p>}

              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-slate-400">{event.sourceLabel}</span>
                {event.href && (
                  <Link href={event.href} className="text-[11px] font-medium text-blue-600 hover:underline">
                    View record →
                  </Link>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
