'use client'

import { useState, useTransition } from 'react'
import { updateSalesMember } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save } from 'lucide-react'
import type { SalesMemberWithUser } from '@/actions/sales-members'
import type { CommissionPlan } from '@/db/schema'

interface Props {
  member: SalesMemberWithUser
  plans: CommissionPlan[]
  managers: SalesMemberWithUser[]
}

export function SalesMemberEditForm({ member, plans, managers }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState(member.status as 'active' | 'inactive' | 'terminated')
  const [commissionPlanId, setCommissionPlanId] = useState(member.commissionPlanId ?? '')
  const [managerId, setManagerId] = useState(member.managerId ?? '')
  const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'in_progress' | 'complete'>(member.onboardingStatus as 'pending' | 'in_progress' | 'complete')
  const [hireDate, setHireDate] = useState(member.hireDate ?? '')
  const [homeRegion, setHomeRegion] = useState(member.homeRegion ?? '')
  const [notes, setNotes] = useState(member.notes ?? '')

  function handleSave() {
    setSaved(false)
    startTransition(async () => {
      await updateSalesMember(member.id, {
        status,
        commissionPlanId: commissionPlanId || null,
        managerId: managerId || null,
        onboardingStatus,
        hireDate: hireDate || null,
        homeRegion: homeRegion || null,
        notes: notes || null,
      })
      setSaved(true)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Member Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as 'active' | 'inactive' | 'terminated')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Commission Plan</Label>
          <Select value={commissionPlanId} onValueChange={setCommissionPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Reports To (Manager)</Label>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {managers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Onboarding Status</Label>
          <Select value={onboardingStatus} onValueChange={v => setOnboardingStatus(v as 'pending' | 'in_progress' | 'complete')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Hire Date</Label>
            <Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Home Region</Label>
            <Input value={homeRegion} onChange={e => setHomeRegion(e.target.value)} placeholder="e.g. DC Metro" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes" />
        </div>

        <Button onClick={handleSave} disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}
