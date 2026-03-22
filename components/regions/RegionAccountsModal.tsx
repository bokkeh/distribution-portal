'use client'

import { useState, useMemo } from 'react'
import { assignAccountsToRegion } from '@/actions/sales-members'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Search, CheckSquare, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RegionMapAccount, RegionMapRegion } from '@/actions/regions-map'

interface Props {
  region: RegionMapRegion
  allRegions: RegionMapRegion[]
  accounts: RegionMapAccount[]
  onClose: () => void
}

export function RegionAccountsModal({ region, allRegions, accounts, onClose }: Props) {
  const [isPending, setIsPending] = useState(false)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'this_region' | 'unassigned'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [alsoAssignRep, setAlsoAssignRep] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Optimistic local account state so changes reflect immediately without full reload
  const [localAccounts, setLocalAccounts] = useState(accounts)

  const filtered = useMemo(() => {
    return localAccounts.filter(a => {
      if (search && !a.companyName.toLowerCase().includes(search.toLowerCase()) &&
        !(a.city ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (filter === 'this_region' && a.regionId !== region.id) return false
      if (filter === 'unassigned' && a.regionId) return false
      return true
    })
  }, [localAccounts, search, filter, region.id])

  const inRegionCount = localAccounts.filter(a => a.regionId === region.id).length
  const inRegionSelectedCount = Array.from(selected).filter(
    id => localAccounts.find(a => a.id === id)?.regionId === region.id,
  ).length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)))
  }

  async function handleAdd() {
    if (!selected.size || isPending) return
    const ids = Array.from(selected)
    const repId = alsoAssignRep ? region.assignedManagerId : null
    setError(null)
    setIsPending(true)
    try {
      await assignAccountsToRegion(ids, region.id, repId)
      setLocalAccounts(prev =>
        prev.map(a => ids.includes(a.id) ? { ...a, regionId: region.id } : a),
      )
      setSelected(new Set())
      window.location.reload()
    } catch (e) {
      console.error('assignAccountsToRegion error:', e)
      setError(e instanceof Error ? e.message : 'Failed to update accounts. Please try again.')
    } finally {
      setIsPending(false)
    }
  }

  async function handleRemove() {
    const ids = Array.from(selected).filter(
      id => localAccounts.find(a => a.id === id)?.regionId === region.id,
    )
    if (!ids.length || isPending) return
    setError(null)
    setIsPending(true)
    try {
      await assignAccountsToRegion(ids, null, null)
      setLocalAccounts(prev =>
        prev.map(a => ids.includes(a.id) ? { ...a, regionId: null } : a),
      )
      setSelected(new Set())
      window.location.reload()
    } catch (e) {
      console.error('assignAccountsToRegion error:', e)
      setError(e instanceof Error ? e.message : 'Failed to update accounts. Please try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage Accounts</h2>
            <p className="text-sm text-slate-500">
              {region.name}
              {region.assignedRep && (
                <span className="ml-1.5 text-slate-400">· Rep: {region.assignedRep.name}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b bg-slate-50 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              <SelectItem value="this_region">In this region</SelectItem>
              <SelectItem value="unassigned">No region</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b bg-white min-h-[44px]">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 shrink-0"
          >
            {selected.size === filtered.length && filtered.length > 0
              ? <CheckSquare className="w-4 h-4 text-blue-600" />
              : <Square className="w-4 h-4" />}
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </button>

          {selected.size > 0 ? (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {region.assignedManagerId && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoAssignRep}
                    onChange={e => setAlsoAssignRep(e.target.checked)}
                    className="rounded"
                  />
                  Also assign rep
                </label>
              )}
              {inRegionSelectedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleRemove}
                  disabled={isPending}
                >
                  {isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Remove {inRegionSelectedCount}
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleAdd}
                disabled={isPending}
              >
                {isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Add {selected.size} to region
              </Button>
            </div>
          ) : (
            <span className="ml-auto text-xs text-slate-400">{filtered.length} shown</span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Account list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">No accounts match your filters.</p>
          ) : (
            filtered.map(a => {
              const inThis = a.regionId === region.id
              const inOther = a.regionId && !inThis
              const otherName = inOther ? allRegions.find(r => r.id === a.regionId)?.name : null
              const isSelected = selected.has(a.id)

              return (
                <div
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 border-b cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="shrink-0">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.companyName}</p>
                    {(a.city || a.state) && (
                      <p className="text-xs text-slate-400">{[a.city, a.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.accountType && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize text-slate-500">
                        {a.accountType.replace('_', ' ')}
                      </Badge>
                    )}
                    {inThis && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-300 bg-green-50">
                        In region
                      </Badge>
                    )}
                    {otherName && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 bg-amber-50">
                        {otherName}
                      </Badge>
                    )}
                    {!a.regionId && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">
                        No region
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-slate-50">
          <p className="text-xs text-slate-500">
            {inRegionCount} account{inRegionCount !== 1 ? 's' : ''} currently in {region.name}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
