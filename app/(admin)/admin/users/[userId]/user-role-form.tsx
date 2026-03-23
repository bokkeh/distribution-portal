'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { activateUser, deactivateUser, updateUserRole } from '@/actions/users'
import { ALL_FEATURES, getDefaultFeaturesForRoles } from '@/lib/users/features'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const ALL_ROLES = ['admin', 'staff', 'driver', 'customer', 'taster', 'sales_rep', 'sales_manager'] as const

interface Props {
  user: {
    id: string
    role: string
    roles: string[]
    phone: string | null
    active: boolean
    featureFlags: string[] | null
  }
  accountId?: string
}

export function UserRoleForm({ user, accountId }: Props) {
  const [state, action, pending] = useActionState(updateUserRole, null)
  const effectiveFeatures = user.featureFlags ?? getDefaultFeaturesForRoles(user.roles)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to update access', { description: state.error })
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          key={`${user.role}|${user.roles.join(',')}|${effectiveFeatures.join(',')}`}
          action={action}
          className="space-y-4"
        >
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="phone" value={user.phone ?? ''} />

          <div className="space-y-2">
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
                {pending ? 'Saving...' : 'Save Access'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role Tags</Label>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3 text-sm">
              {ALL_ROLES.map(role => (
                <label key={role} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={user.roles.includes(role)}
                    className="rounded"
                  />
                  {role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Feature Access</Label>
              {user.featureFlags ? <Badge variant="secondary">Custom</Badge> : <Badge variant="outline">Role defaults</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3 text-sm sm:grid-cols-3">
              {ALL_FEATURES.map(feature => (
                <label key={feature.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="features"
                    value={feature.key}
                    defaultChecked={effectiveFeatures.includes(feature.key)}
                    className="rounded"
                  />
                  {feature.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Save a custom feature list here to turn sections on or off for this specific user without changing their role tags.
            </p>
          </div>
        </form>

        {user.active ? (
          <form action={deactivateUser.bind(null, user.id)}>
            <ConfirmSubmitButton variant="destructive" className="w-full" title="Deactivate this account?" description="The user will immediately lose access to the portal." confirmLabel="Deactivate">Deactivate Account</ConfirmSubmitButton>
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
