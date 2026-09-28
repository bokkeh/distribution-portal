'use client'

import { useMemo, useState } from 'react'
import { Avatar, formatNumber } from './shared'
import type { RosterEntry } from '@/actions/progression'
import { Trophy } from 'lucide-react'

type Category = 'bottles' | 'cases' | 'avg_per_tasting' | 'tastings' | 'accounts' | 'reorders' | 'training' | 'most_improved'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'bottles', label: 'Bottles Sold' },
  { id: 'cases', label: 'Cases Sold' },
  { id: 'avg_per_tasting', label: 'Best Average / Tasting' },
  { id: 'tastings', label: 'Tastings Completed' },
  { id: 'accounts', label: 'New Accounts Opened' },
  { id: 'reorders', label: 'Reorders Influenced' },
  { id: 'training', label: 'Training Impact' },
  { id: 'most_improved', label: 'Most Improved' },
]

const LEVEL_BRACKETS = [
  { id: 'all', label: 'All levels', test: () => true },
  { id: 'ambassadors', label: 'Brand Ambassadors (L1–3)', test: (l: number) => l <= 3 },
  { id: 'trainers', label: 'Trainers (L4, L6)', test: (l: number) => l === 4 || l === 6 },
  { id: 'sales', label: 'Sales & Leadership (L5, L7–10)', test: (l: number) => l === 5 || l >= 7 },
]

function valueFor(category: Category, e: RosterEntry) {
  switch (category) {
    case 'bottles': return e.performance.bottlesSold
    case 'cases': return e.performance.casesSold
    case 'avg_per_tasting': return e.performance.avgBottlesPerTasting ?? 0
    case 'tastings': return e.performance.tastingsCompleted
    case 'accounts': return e.performance.accountsOpened
    case 'reorders': return e.performance.reordersInfluenced
    case 'training': return e.performance.teamMembersTrained
    default: return 0
  }
}

export function LeaderboardView({ entries, mostImproved }: { entries: RosterEntry[]; mostImproved: { entry: RosterEntry; delta: number }[] }) {
  const [category, setCategory] = useState<Category>('bottles')
  const [bracket, setBracket] = useState('all')

  const ranked = useMemo(() => {
    const bracketTest = LEVEL_BRACKETS.find(b => b.id === bracket)?.test ?? (() => true)
    if (category === 'most_improved') {
      return mostImproved.filter(r => bracketTest(r.entry.level)).slice(0, 25).map(r => ({ entry: r.entry, value: r.delta, suffix: r.delta >= 0 ? ' bottles ↑' : ' bottles' }))
    }
    return entries
      .filter(e => bracketTest(e.level))
      .map(e => ({ entry: e, value: valueFor(category, e), suffix: '' }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 25)
  }, [category, entries, mostImproved, bracket])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${category === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LEVEL_BRACKETS.map(b => (
          <button key={b.id} onClick={() => setBracket(b.id)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${bracket === b.id ? 'border-slate-400 bg-slate-50 text-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {b.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No qualifying activity in this category yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {ranked.map((r, idx) => (
            <li key={r.entry.userId} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
              <span className={`w-6 shrink-0 text-center text-sm font-bold ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}`}>{idx === 0 ? <Trophy className="mx-auto h-4 w-4" /> : idx + 1}</span>
              <Avatar name={r.entry.name} avatarUrl={r.entry.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{r.entry.name}</p>
                <p className="truncate text-xs text-slate-400">L{r.entry.level} · {r.entry.rankName}{r.entry.homeRegion ? ` · ${r.entry.homeRegion}` : ''}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-slate-900">{formatNumber(r.value)}{r.suffix}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
