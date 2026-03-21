'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSalesRegion, deleteSalesRegion } from '@/actions/sales-members'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Globe, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import type { SalesMemberWithUser } from '@/actions/sales-members'

type Region = {
  id: string
  name: string
  description: string | null
  assignedManagerId: string | null
  createdAt: Date
}

interface Props {
  regions: Region[]
  members: SalesMemberWithUser[]
}

export function RegionList({ regions: initialRegions, members }: Props) {
  const router = useRouter()
  const [regions, setRegions] = useState(initialRegions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Edit state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editManagerId, setEditManagerId] = useState('none')

  const memberMap = Object.fromEntries(members.map(m => [m.id, m.user.name]))

  function startEdit(r: Region) {
    setEditingId(r.id)
    setEditName(r.name)
    setEditDescription(r.description ?? '')
    setEditManagerId(r.assignedManagerId ?? 'none')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleSave(id: string) {
    startTransition(async () => {
      await updateSalesRegion(id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        assignedManagerId: editManagerId === 'none' ? null : editManagerId,
      })
      setRegions(prev => prev.map(r =>
        r.id === id
          ? { ...r, name: editName.trim(), description: editDescription.trim() || null, assignedManagerId: editManagerId === 'none' ? null : editManagerId }
          : r
      ))
      setEditingId(null)
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      await deleteSalesRegion(id)
      setRegions(prev => prev.filter(r => r.id !== id))
      setDeletingId(null)
    })
  }

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
    <div className="space-y-3">
      {regions.map(r => {
        const isEditing = editingId === r.id
        const isDeleting = deletingId === r.id

        if (isEditing) {
          return (
            <Card key={r.id} className="border-blue-200">
              <CardContent className="py-4 space-y-3">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Region name"
                  className="h-8 text-sm"
                />
                <Input
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="h-8 text-sm"
                />
                <Select value={editManagerId} onValueChange={setEditManagerId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="No manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No manager</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(r.id)}
                    disabled={isPending || !editName.trim()}
                    className="h-7 text-xs"
                  >
                    {isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 text-xs">
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
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  {r.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>
                  )}
                  {r.assignedManagerId && memberMap[r.assignedManagerId] && (
                    <Badge variant="outline" className="text-xs mt-1.5">
                      Manager: {memberMap[r.assignedManagerId]}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    onClick={() => startEdit(r)}
                    disabled={isPending}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                    onClick={() => handleDelete(r.id)}
                    disabled={isPending}
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
