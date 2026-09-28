import Link from 'next/link'
import { RANKS } from '@/lib/progression/ranks'
import { WISHER_GOLD, WISHER_NAVY } from './shared'

export function ProgressionLadder({ counts, rosterHref }: { counts: Map<number, number>; rosterHref: string }) {
  return (
    <div className="space-y-2">
      {[...RANKS].reverse().map((rank) => {
        const count = counts.get(rank.level) ?? 0
        return (
          <Link
            key={rank.level}
            href={`${rosterHref}?level=${rank.level}`}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${WISHER_NAVY}, #16305c)`, border: `1.5px solid ${WISHER_GOLD}` }}
            >
              {rank.level}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="font-semibold text-slate-900">{rank.name}</p>
                <span className="text-xs text-slate-400">{rank.careerStage}</span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{rank.milestone}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold text-slate-900">{count}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{count === 1 ? 'member' : 'members'}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
