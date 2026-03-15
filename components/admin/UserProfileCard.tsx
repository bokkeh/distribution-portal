'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { updateUserProfile } from '@/actions/users'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ProfilePhotoUploadField } from '@/components/profile/ProfilePhotoUploadField'

type UserProfileCardProps = {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    avatarUrl: string | null
  }
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const [state, action, pending] = useActionState(updateUserProfile, null)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to update user', { description: state.error })
    } else if (state && !state.error) {
      toast.success('User profile updated')
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="avatarUrl" value={avatarUrl} />

          <ProfilePhotoUploadField value={avatarUrl} onChange={setAvatarUrl} disabled={pending} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={user.email} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ''} placeholder="+1 (555) 000-0000" />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save User Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
