'use client'

import { useState, useMemo, useTransition } from 'react'
import { assignAccountToRep, assignAccountsToRep, bulkUpdateAccountAssignment } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building2, X, Loader2, UserPlus, Search, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  memberId: string
  memberName: string
  allAccounts: AccountRow[]
}

const PRIORITY_LABELS: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-700 border-red-200 bg-red-50',
  medium: 'text-blue-700 border-blue-200 bg-blue-50',
  low: 'text-slate-600 border-slate-200 bg-slate-50',
}

export function AccountAssignmentPanel({ memberId, memberName, allAccounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [showOverlay, setShowOverlay] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Overlay state
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterAssignment, setFilterAssignment] = useState<'all' | 'unassigned' | 'mine'>('all')
  const [filterState, setFilterState] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk assignment settings
  const [visitFrequency, setVisitFrequency] = useState('30')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | 'keep'>('keep')

  const assignedAccounts = accounts.filter(a => a.assignedSalesRepId === memberId)

  const uniqueStates = useMemo(
    () => Array.from(new Set(accounts.map(a => a.state).filter(Boolean))).sort() as string[],
    [accounts],
  )
  const uniqueTypes = useMemo(
    () => Array.from(new Set(accounts.map(a => a.accountType).filter(Boolean))).sort() as string[],
    [accounts],
  )

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (search && !a.companyName.toLowerCase().includes(search.toLowerCase()) &&
          !(a.city ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterType !== 'all' && a.accountType !== filterType) return false
      if (filterState !== 'all' && a.state !== filterState) return false
      if (filterAssignment === 'unassigned' && a.assignedSalesRepId) return false
      if (filterAssignment === 'mine' && a.assignedSalesRepId !== memberId) return false
      return true
    })
  }, [accounts, search, filterType, filterState, filterAssignment, memberId])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filteredAccounts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredAccounts.map(a => a.id)))
    }
  }

  function handleUnassign(customerId: string) {
    setRemoving(customerId)
    startTransition(async () => {
      await assignAccountToRep(customerId, null)
      setAccounts(prev => prev.map(a => a.id === customerId ? { ...a, assignedSalesRepId: null } : a))
      setRemoving(null)
    })
  }

  function handleAssignSelected() {
    if (selected.size === 0) return
    const ids = Array.from(selected)

    startTransition(async () => {
      await assignAccountsToRep(ids, memberId)

      const updates: Parameters<typeof bulkUpdateAccountAssignment>[1] = {}
      if (visitFrequency) updates.visitFrequency = parseInt(visitFrequency)
      if (priority !== 'keep') updates.accountPriority = priority

      if (Object.keys(updates).length) {
        await bulkUpdateAccountAssignment(ids, updates)
      }

      setAccounts(prev => prev.map(a =>
        ids.includes(a.id)
          ? {
              ...a,
              assignedSalesRepId: memberId,
              visitFrequency: visitFrequency ? parseInt(visitFrequency) : a.visitFrequency,
              accountPriority: priority !== 'keep' ? priority : a.accountPriority,
            }
          : a
      ))
      setSelected(new Set())
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              Assigned Accounts ({assignedAccounts.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowOverlay(true)}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Assign Accounts
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {assignedAccounts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No accounts assigned.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {assignedAccounts.map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{a.companyName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(a.city || a.state) && (
                        <span className="text-xs text-slate-400">{[a.city, a.state].filter(Boolean).join(', ')}</span>
                      )}
                      {a.accountPriority && (
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${PRIORITY_COLORS[a.accountPriority] ?? ''}`}>
                          {PRIORITY_LABELS[a.accountPriority] ?? a.accountPriority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
                    onClick={() => handleUnassign(a.id)}
                    disabled={removing === a.id || isPending}
                  >
                    {removing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full-screen overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Assign Accounts</h2>
                <p className="text-sm text-slate-500">to {memberName}</p>
              </div>
              <button onClick={() => { setShowOverlay(false); setSelected(new Set()) }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b bg-slate-50 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search accounts..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Select value={filterAssignment} onValueChange={v => setFilterAssignment(v as typeof filterAssignment)}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    <SelectItem value="unassigned">Unassigned only</SelectItem>
                    <SelectItem value="mine">Assigned to rep</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger className="h-8 text-xs w-24">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {uniqueStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk action bar */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b bg-white">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
                {selected.size === filteredAccounts.length && filteredAccounts.length > 0
                  ? <CheckSquare className="w-4 h-4 text-blue-600" />
                  : <Square className="w-4 h-4" />
                }
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </button>

              {selected.size > 0 && (
                <>
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs whitespace-nowrap">Visit every</Label>
                      <Select value={visitFrequency} onValueChange={setVisitFrequency}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">Priority</Label>
                      <Select value={priority} onValueChange={v => setPriority(v as typeof priority)}>
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keep">Keep</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAssignSelected}
                      disabled={isPending}
                      className="h-7 text-xs"
                    >
                      {isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Assign {selected.size} account{selected.size !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </>
              )}

              {selected.size === 0 && (
                <span className="ml-auto text-xs text-slate-400">{filteredAccounts.length} accounts shown</span>
              )}
            </div>

            {/* Account list */}
            <div className="flex-1 overflow-y-auto">
              {filteredAccounts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">No accounts match your filters.</p>
              ) : (
                filteredAccounts.map(a => {
                  const isAssignedToMe = a.assignedSalesRepId === memberId
                  const isAssignedElsewhere = a.assignedSalesRepId && a.assignedSalesRepId !== memberId
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
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4 text-slate-300" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{a.companyName}</p>
                        <p className="text-xs text-slate-400">{[a.city, a.state].filter(Boolean).join(', ')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.accountType && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize text-slate-500">
                            {a.accountType.replace('_', ' ')}
                          </Badge>
                        )}
                        {isAssignedToMe && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-300 bg-green-50">
                            Assigned
                          </Badge>
                        )}
                        {isAssignedElsewhere && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 bg-amber-50">
                            Other rep
                          </Badge>
                        )}
                        {!a.assignedSalesRepId && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">
                            Unassigned
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
                {assignedAccounts.length} account{assignedAccounts.length !== 1 ? 's' : ''} currently assigned to {memberName}
              </p>
              <Button variant="outline" size="sm" onClick={() => { setShowOverlay(false); setSelected(new Set()) }}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
