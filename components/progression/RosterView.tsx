'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, EligibilityBadge, formatDate, formatNumber } from './shared'
import { Users, ChevronDown } from 'lucide-react'
import type { RosterEntry } from '@/actions/progression'
import { RANKS } from '@/lib/progression/ranks'

type SortKey = 'rank' | 'tastings' | 'bottles' | 'cases' | 'avgBottles' | 'accounts' | 'reorders' | 'progress' | 'activity'

const SORTERS: Record<SortKey, (a: RosterEntry, b: RosterEntry) => number> = {
  rank: (a, b) => b.level - a.level,
  tastings: (a, b) => b.performance.tastingsCompleted - a.performance.tastingsCompleted,
  bottles: (a, b) => b.performance.bottlesSold - a.performance.bottlesSold,
  cases: (a, b) => b.performance.casesSold - a.performance.casesSold,
  avgBottles: (a, b) => (b.performance.avgBottlesPerTasting ?? 0) - (a.performance.avgBottlesPerTasting ?? 0),
  accounts: (a, b) => b.performance.accountsOpened - a.performance.accountsOpened,
  reorders: (a, b) => b.performance.reordersInfluenced - a.performance.reordersInfluenced,
  progress: (a, b) => (b.progressPercent ?? -1) - (a.progressPercent ?? -1),
  activity: (a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0),
}

export function RosterView({ entries, baseHref, initialLevel, initialEligibility }: {
  entries: RosterEntry[]
  baseHref: string
  initialLevel?: number
  initialEligibility?: string
}) {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<number | 'all'>(initialLevel ?? 'all')
  const [market, setMarket] = useState<string>('all')
  const [manager, setManager] = useState<string>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [eligibility, setEligibility] = useState<string>(initialEligibility ?? 'all')
  const [sort, setSort] = useState<SortKey>('rank')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const markets = useMemo(() => Array.from(new Set(entries.map(e => e.homeRegion).filter(Boolean))) as string[], [entries])
  const managers = useMemo(() => Array.from(new Set(entries.map(e => e.managerName).filter(Boolean))) as string[], [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries
      .filter(e => level === 'all' || e.level === level)
      .filter(e => market === 'all' || e.homeRegion === market)
      .filter(e => manager === 'all' || e.managerName === manager)
      .filter(e => status === 'all' || (status === 'active' ? e.active : !e.active))
      .filter(e => eligibility === 'all' || e.eligibilityStatus === eligibility)
      .filter(e => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.homeRegion ?? '').toLowerCase().includes(q))
      .sort(SORTERS[sort])
  }, [entries, search, level, market, manager, status, eligibility, sort])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Search by name, email, or territory…" value={search} onChange={e => setSearch(e.target.value)} className="sm:max-w-xs" />
        <button
          type="button"
          onClick={() => setFiltersOpen(v => !v)}
          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 sm:hidden"
        >
          Filters &amp; sort <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`grid gap-3 sm:grid-cols-3 lg:grid-cols-6 ${filtersOpen ? '' : 'hidden sm:grid'}`}>
        <Select label="Rank" value={String(level)} onChange={v => setLevel(v === 'all' ? 'all' : Number(v))} options={[{ value: 'all', label: 'All ranks' }, ...RANKS.map(r => ({ value: String(r.level), label: `L${r.level} · ${r.name}` }))]} />
        <Select label="Market" value={market} onChange={setMarket} options={[{ value: 'all', label: 'All markets' }, ...markets.map(m => ({ value: m, label: m }))]} />
        <Select label="Manager" value={manager} onChange={setManager} options={[{ value: 'all', label: 'All managers' }, ...managers.map(m => ({ value: m, label: m }))]} />
        <Select label="Status" value={status} onChange={v => setStatus(v as typeof status)} options={[{ value: 'all', label: 'Active & inactive' }, { value: 'active', label: 'Active only' }, { value: 'inactive', label: 'Inactive only' }]} />
        <Select label="Eligibility" value={eligibility} onChange={setEligibility} options={[{ value: 'all', label: 'All' }, { value: 'not_yet_eligible', label: 'Not yet eligible' }, { value: 'eligible_for_review', label: 'Eligible for review' }, { value: 'approved_for_promotion', label: 'Approved for promotion' }]} />
        <Select label="Sort by" value={sort} onChange={v => setSort(v as SortKey)} options={[
          { value: 'rank', label: 'Highest rank' },
          { value: 'tastings', label: 'Tastings completed' },
          { value: 'bottles', label: 'Bottles sold' },
          { value: 'cases', label: 'Cases sold' },
          { value: 'avgBottles', label: 'Avg bottles / tasting' },
          { value: 'accounts', label: 'Accounts opened' },
          { value: 'reorders', label: 'Reorders influenced' },
          { value: 'progress', label: 'Progress to next rank' },
          { value: 'activity', label: 'Most recent activity' },
        ]} />
      </div>

      <p className="text-sm text-slate-500">{filtered.length} of {entries.length} team members</p>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No team members match these filters" description="Try widening your search or clearing a filter." />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map(e => <RosterCard key={e.userId} entry={e} baseHref={baseHref} />)}
          </div>

          {/* Desktop: table-like grid */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 sm:block">
            <div className="grid grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Member</span><span>Rank</span><span>Tastings</span><span>Bottles</span><span>Cases</span><span>Progress</span><span>Eligibility</span>
            </div>
            {filtered.map(e => (
              <Link key={e.userId} href={`${baseHref}/${e.userId}`} className="grid grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50 last:border-b-0">
                <span className="flex items-center gap-3 min-w-0">
                  <Avatar name={e.name} avatarUrl={e.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{e.name}</span>
                    <span className="block truncate text-xs text-slate-400">{e.homeRegion ?? 'No market set'}{e.managerName ? ` · ${e.managerName}` : ''}</span>
                  </span>
                </span>
                <span className="text-slate-700">L{e.level} · {e.rankName}{e.isTemporary && <Badge variant="outline" className="ml-1 text-[10px]">Temp</Badge>}</span>
                <span>{e.performance.tastingsCompleted}</span>
                <span>{formatNumber(e.performance.bottlesSold)}</span>
                <span>{formatNumber(e.performance.casesSold)}</span>
                <span className="min-w-[80px]">{e.progressPercent != null ? <MiniProgress value={e.progressPercent} /> : <span className="text-slate-400">Max level</span>}</span>
                <span><EligibilityBadge status={e.eligibilityStatus} /></span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MiniProgress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: '#c9a34e' }} />
      </div>
      <span className="text-xs text-slate-500">{value}%</span>
    </div>
  )
}

function RosterCard({ entry, baseHref }: { entry: RosterEntry; baseHref: string }) {
  return (
    <Link href={`${baseHref}/${entry.userId}`} className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50">
      <div className="flex items-center gap-3">
        <Avatar name={entry.name} avatarUrl={entry.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{entry.name}</p>
          <p className="truncate text-xs text-slate-400">L{entry.level} · {entry.rankName}</p>
        </div>
        <EligibilityBadge status={entry.eligibilityStatus} />
      </div>
      {entry.progressPercent != null && (
        <div className="mt-3">
          <Progress value={entry.progressPercent} label="Progress to next rank" tone="accent" />
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
        <div><p className="font-semibold text-slate-900">{entry.performance.tastingsCompleted}</p>Tastings</div>
        <div><p className="font-semibold text-slate-900">{formatNumber(entry.performance.bottlesSold)}</p>Bottles</div>
        <div><p className="font-semibold text-slate-900">{formatDate(entry.lastActivityAt)}</p>Last active</div>
      </div>
    </Link>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
