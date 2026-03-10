'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { updateUserRole, activateUser, deactivateUser } from '@/actions/users'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const ALL_ROLES = ['admin', 'staff', 'driver', 'customer'] as const

interface Props {
  user: {
    id: string
    role: string
    roles: string[]
    phone: string | null
    active: boolean
  }
  accountId?: string
}

export function UserRoleForm({ user, accountId }: Props) {
  const [state, action, pending] = useActionState(updateUserRole, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to update role', { description: state.error })
    }
  }, [state])

  return (
    <Card>
      <CardHeader><CardTitle>Account Actions</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form action={action} className="space-y-2">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="phone" value={user.phone ?? ''} />
          <Label htmlFor="role">Primary Role</Label>
          <div className="flex gap-2">
            <select
              id="role"
              name="role"
              defaultValue={user.role}
              className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ALL_ROLES.map(role => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? 'Saving…' : 'Save Roles'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3 text-sm">
            {ALL_ROLES.map(role => (
              <label key={role} className="flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  name="roles"
                  value={role}
                  defaultChecked={user.roles.includes(role)}
                  className="rounded"
                />
                {role}
              </label>
            ))}
          </div>
        </form>

        {user.active ? (
          <form action={deactivateUser.bind(null, user.id)}>
            <Button variant="destructive" className="w-full" type="submit">Deactivate Account</Button>
          </form>
        ) : (
          <form action={activateUser.bind(null, user.id)}>
            <Button className="w-full" type="submit">Reactivate Account</Button>
          </form>
        )}

        {accountId ? (
          <Link href={`/admin/crm/${accountId}`}>
            <Button variant="outline" className="w-full">View CRM Account</Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
