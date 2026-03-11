'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { updateSimpleProfile } from '@/actions/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from 'lucide-react'

interface Props {
  user: { id: string; name: string; email: string; phone: string | null }
}

export function SimpleProfileForm({ user }: Props) {
  const [state, action, pending] = useActionState(updateSimpleProfile, null)

  useEffect(() => {
    if (state?.error) toast.error('Failed to save', { description: state.error })
    else if (state && !state.error) toast.success('Profile saved')
  }, [state])

  return (
    <form action={action} className="space-y-6 max-w-lg">
      <input type="hidden" name="userId" value={user.id} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-muted-foreground" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  )
}
