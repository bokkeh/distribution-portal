'use client'

import { useState, useTransition, useMemo } from 'react'
import { updateSalesRegion, deleteSalesRegion, assignAccountsToRegion } from '@/actions/sales-members'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Globe, Pencil, Trash2, Check, X, Loader2, Building2, Search, CheckSquare, Square, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SalesMemberWithUser } from '@/actions/sales-members'

type Region = {
  id: string
  name: string
  description: string | null
  assignedManagerId: string | null
  createdAt: Date
}

type AccountRow = {
  id: string
  companyName: string
  city: string | null
  state: string | null
  businessType: string | null
  accountType: string | null
  accountPriority: string | null
  dealStage: string | null
  assignedSalesRepId: string | null
  assignedRegionId: string | null
  visitFrequency: number | null
}

interface Props {
  regions: Region[]
  members: SalesMemberWithUser[]
  allAccounts: AccountRow[]
  accountStats: Record<string, number>
}

export function RegionList({ regions: initialRegions, members, allAccounts: initialAccounts, accountStats: initialStats }: Props) {
  const [regions, setRegions] = useState(initialRegions)
  const [accounts, setAccounts] = useState(initialAccounts)
  const [stats, setStats] = useState(initialStats)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [managingRegion, setManagingRegion] = useState<Region | null>(null)
  const [isPending, startTransition] = useTransition()
  const [assignPending, setAssignPending] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Edit state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editManagerId, setEditManagerId] = useState('none')

  // Overlay filter state
  const [search, setSearch] = useState('')
  const [filterAssignment, setFilterAssignment] = useState<'all' | 'this_region' | 'unassigned'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [alsoAssignRep, setAlsoAssignRep] = useState(true)

  const memberMap = Object.fromEntries(members.map(m => [m.id, m.user.name]))

  function startEdit(r: Region) {
    setEditingId(r.id)
    setEditName(r.name)
    setEditDescription(r.description ?? '')
    setEditManagerId(r.assignedManagerId ?? 'none')
  }

  function handleSave(id: string) {
    startTransition(async () => {
      const newManagerId = editManagerId === 'none' ? null : editManagerId
      await updateSalesRegion(id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        assignedManagerId: newManagerId,
      })
      setRegions(prev => prev.map(r =>
        r.id === id ? { ...r, name: editName.trim(), description: editDescription.trim() || null, assignedManagerId: newManagerId } : r
      ))
      // Cascade rep assignment optimistically
      setAccounts(prev => prev.map(a =>
        a.assignedRegionId === id ? { ...a, assignedSalesRepId: newManagerId } : a
      ))
      setEditingId(null)
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      await deleteSalesRegion(id)
      setRegions(prev => prev.filter(r => r.id !== id))
      setAccounts(prev => prev.map(a => a.assignedRegionId === id ? { ...a, assignedRegionId: null, assignedSalesRepId: null } : a))
      setStats(prev => { const next = { ...prev }; delete next[id]; return next })
      setDeletingId(null)
    })
  }

  function openManage(r: Region) {
    setManagingRegion(r)
    setSearch('')
    setFilterAssignment('all')
    setSelected(new Set())
    setAlsoAssignRep(true)
  }

  const filteredAccounts = useMemo(() => {
    if (!managingRegion) return []
    return accounts.filter(a => {
      if (search && !a.companyName.toLowerCase().includes(search.toLowerCase()) &&
          !(a.city ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterAssignment === 'this_region' && a.assignedRegionId !== managingRegion.id) return false
      if (filterAssignment === 'unassigned' && a.assignedRegionId) return false
      return true
    })
  }, [accounts, search, filterAssignment, managingRegion])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filteredAccounts.length) setSelected(new Set())
    else setSelected(new Set(filteredAccounts.map(a => a.id)))
  }

  async function handleAssignToRegion() {
    if (!managingRegion || selected.size === 0 || assignPending) return
    const ids = Array.from(selected)
    const repId = (alsoAssignRep && managingRegion.assignedManagerId) ? managingRegion.assignedManagerId : null
    const newlyAdded = ids.filter(id => accounts.find(a => a.id === id)?.assignedRegionId !== managingRegion.id).length
    setAssignError(null)
    setAssignPending(true)
    try {
      await assignAccountsToRegion(ids, managingRegion.id, repId)
      setAccounts(prev => prev.map(a =>
        ids.includes(a.id)
          ? { ...a, assignedRegionId: managingRegion.id, assignedSalesRepId: alsoAssignRep ? repId : a.assignedSalesRepId }
          : a
      ))
      setStats(prev => ({ ...prev, [managingRegion.id]: (prev[managingRegion.id] ?? 0) + newlyAdded }))
      setSelected(new Set())
      window.location.reload()
    } catch (e) {
      console.error('assignAccountsToRegion error:', e)
      setAssignError(e instanceof Error ? e.message : 'Failed to update accounts. Please try again.')
    } finally {
      setAssignPending(false)
    }
  }

  async function handleRemoveFromRegion() {
    if (!managingRegion || selected.size === 0 || assignPending) return
    const ids = Array.from(selected).filter(id => accounts.find(a => a.id === id)?.assignedRegionId === managingRegion.id)
    if (!ids.length) return
    setAssignError(null)
    setAssignPending(true)
    try {
      await assignAccountsToRegion(ids, null, null)
      setAccounts(prev => prev.map(a =>
        ids.includes(a.id) ? { ...a, assignedRegionId: null, assignedSalesRepId: null } : a
      ))
      setStats(prev => ({ ...prev, [managingRegion.id]: Math.max(0, (prev[managingRegion.id] ?? 0) - ids.length) }))
      setSelected(new Set())
      window.location.reload()
    } catch (e) {
      console.error('assignAccountsToRegion error:', e)
      setAssignError(e instanceof Error ? e.message : 'Failed to update accounts. Please try again.')
    } finally {
      setAssignPending(false)
    }
  }

  const inRegionSelectedCount = managingRegion
    ? Array.from(selected).filter(id => accounts.find(a => a.id === id)?.assignedRegionId === managingRegion.id).length
    : 0

  if (regions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-400">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No regions yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {regions.map(r => {
          const isEditing = editingId === r.id
          const isDeleting = deletingId === r.id
          const accountCount = stats[r.id] ?? 0
          const managerChanged = editManagerId !== (r.assignedManagerId ?? 'none')

          if (isEditing) {
            return (
              <Card key={r.id} className="border-blue-200">
                <CardContent className="py-4 space-y-3">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Region name" className="h-8 text-sm" autoFocus />
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description (optional)" className="h-8 text-sm" />
                  <div className="space-y-1">
                    <Select value={editManagerId} onValueChange={setEditManagerId}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="No assigned rep" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No assigned rep</SelectItem>
                        {members.map(m => <SelectItem key={m.id} value={m.id}>{m.user.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {accountCount > 0 && managerChanged && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Users className="w-3 h-3 shrink-0" />
                        {accountCount} account{accountCount !== 1 ? 's' : ''} in this region will be reassigned to the new rep
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(r.id)} disabled={isPending || !editName.trim()} className="h-7 text-xs">
                      {isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs">
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card key={r.id} className={isDeleting ? 'opacity-50' : ''}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{r.name}</p>
                      <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                        <Building2 className="w-3 h-3 mr-1" />
                        {accountCount} account{accountCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {r.description && <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>}
                    {r.assignedManagerId && memberMap[r.assignedManagerId] && (
                      <Badge variant="outline" className="text-xs mt-1.5 text-slate-600">
                        Rep: {memberMap[r.assignedManagerId]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openManage(r)} disabled={isPending}>
                      <Building2 className="w-3 h-3 mr-1" />
                      Accounts
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => startEdit(r)} disabled={isPending}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDelete(r.id)} disabled={isPending}>
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Account assignment overlay */}
      {managingRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Manage Accounts</h2>
                <p className="text-sm text-slate-500">
                  {managingRegion.name}
                  {managingRegion.assignedManagerId && memberMap[managingRegion.assignedManagerId] && (
                    <span className="ml-1.5 text-slate-400">· Rep: {memberMap[managingRegion.assignedManagerId]}</span>
                  )}
                </p>
              </div>
              <button onClick={() => setManagingRegion(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b bg-slate-50 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-8 h-8 text-sm" />
              </div>
              <Select value={filterAssignment} onValueChange={v => setFilterAssignment(v as typeof filterAssignment)}>
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
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 shrink-0">
                {selected.size === filteredAccounts.length && filteredAccounts.length > 0
                  ? <CheckSquare className="w-4 h-4 text-blue-600" />
                  : <Square className="w-4 h-4" />
                }
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </button>

              {selected.size > 0 ? (
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  {managingRegion.assignedManagerId && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={alsoAssignRep} onChange={e => setAlsoAssignRep(e.target.checked)} className="rounded" />
                      Also assign rep
                    </label>
                  )}
                  {inRegionSelectedCount > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={handleRemoveFromRegion} disabled={assignPending}>
                      {assignPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Remove {inRegionSelectedCount}
                    </Button>
                  )}
                  <Button size="sm" className="h-7 text-xs" onClick={handleAssignToRegion} disabled={assignPending}>
                    {assignPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    Add {selected.size} to region
                  </Button>
                </div>
              ) : (
                <span className="ml-auto text-xs text-slate-400">{filteredAccounts.length} shown</span>
              )}
            </div>

            {/* Error banner */}
            {assignError && (
              <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
                {assignError}
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredAccounts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">No accounts match your filters.</p>
              ) : (
                filteredAccounts.map(a => {
                  const inThisRegion = a.assignedRegionId === managingRegion.id
                  const inOtherRegion = a.assignedRegionId && !inThisRegion
                  const otherRegionName = inOtherRegion ? regions.find(r => r.id === a.assignedRegionId)?.name : null
                  const isSelected = selected.has(a.id)

                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleSelect(a.id)}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3 border-b cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="shrink-0">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300" />}
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
                        {inThisRegion && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-300 bg-green-50">In region</Badge>
                        )}
                        {otherRegionName && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 bg-amber-50">{otherRegionName}</Badge>
                        )}
                        {!a.assignedRegionId && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">No region</Badge>
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
                {stats[managingRegion.id] ?? 0} account{(stats[managingRegion.id] ?? 0) !== 1 ? 's' : ''} currently in {managingRegion.name}
              </p>
              <Button variant="outline" size="sm" onClick={() => setManagingRegion(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
