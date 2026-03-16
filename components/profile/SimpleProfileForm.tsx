'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { User } from 'lucide-react'
import { updateSimpleProfile } from '@/actions/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProfilePhotoUploadField } from '@/components/profile/ProfilePhotoUploadField'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'
import { COMMON_TIME_ZONES } from '@/lib/timezones'

interface Props {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    avatarUrl: string | null
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
  }
  preferences?: {
    timeZone: string
    notificationPreference: string
    emailNotificationsEnabled: boolean
    smsNotificationsEnabled: boolean
    inAppNotificationsEnabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
  }
}

export function SimpleProfileForm({ user, preferences }: Props) {
  const [state, action, pending] = useActionState(updateSimpleProfile, null)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const formRef = useRef<HTMLFormElement | null>(null)
  const { statusText, clearDraft } = useFormDraftAutosave(formRef, `simple-profile:${user.id}`)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to save', { description: state.error })
      return
    }
    if (state && !state.error) {
      clearDraft()
      toast.success('Profile saved')
    }
  }, [clearDraft, state])

  return (
    <form ref={formRef} action={action} className="space-y-6 max-w-lg">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="avatarUrl" value={avatarUrl} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-muted-foreground" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfilePhotoUploadField value={avatarUrl} onChange={setAvatarUrl} disabled={pending} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={user.email} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input name="phone" type="tel" defaultValue={user.phone ?? ''} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input name="address" defaultValue={user.address ?? ''} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input name="city" defaultValue={user.city ?? ''} placeholder="Houston" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input name="state" defaultValue={user.state ?? ''} placeholder="TX" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input name="zip" defaultValue={user.zip ?? ''} placeholder="77001" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Time Zone</Label>
              <select
                name="timeZone"
                defaultValue={preferences?.timeZone ?? 'America/New_York'}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {COMMON_TIME_ZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>{zone.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notification Mode</Label>
              <select
                name="notificationPreference"
                defaultValue={preferences?.notificationPreference ?? 'all'}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">All notifications</option>
                <option value="important">Important only</option>
                <option value="quiet">Minimal</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notification Channels</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="emailNotificationsEnabled" defaultChecked={preferences?.emailNotificationsEnabled ?? true} />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="smsNotificationsEnabled" defaultChecked={preferences?.smsNotificationsEnabled ?? true} />
                SMS
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="inAppNotificationsEnabled" defaultChecked={preferences?.inAppNotificationsEnabled ?? true} />
                In-app
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quiet Hours Start</Label>
              <Input name="quietHoursStart" type="time" defaultValue={preferences?.quietHoursStart ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label>Quiet Hours End</Label>
              <Input name="quietHoursEnd" type="time" defaultValue={preferences?.quietHoursEnd ?? ''} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">{statusText || 'Draft saves locally while you edit.'}</span>
            <span className={state && !state.error ? 'text-emerald-700' : 'text-slate-500'}>
              {pending ? 'Saving...' : state && !state.error ? 'Saved' : 'Ready'}
            </span>
          </div>
        </CardContent>
      </Card>

      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}
