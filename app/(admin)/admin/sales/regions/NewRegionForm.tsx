'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSalesRegion } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'
import type { SalesMemberWithUser } from '@/actions/sales-members'

export function NewRegionForm({ members }: { members: SalesMemberWithUser[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [managerId, setManagerId] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      await createSalesRegion({
        name: name.trim(),
        description: description.trim() || undefined,
        assignedManagerId: managerId || undefined,
      })
      setName('')
      setDescription('')
      setManagerId('')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Region</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Region Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. DC Metro" required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="space-y-1.5">
            <Label>Assigned Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Region
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
