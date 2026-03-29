'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { updateUserNotificationPreferences } from '@/actions/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface Props {
  userId: string
  emailNotificationsEnabled: boolean
  smsNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean
  notificationPreference: string
}

export function UserNotificationPrefsForm({
  userId,
  emailNotificationsEnabled,
  smsNotificationsEnabled,
  inAppNotificationsEnabled,
  notificationPreference,
}: Props) {
  const [state, action, pending] = useActionState(updateUserNotificationPreferences, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to update preferences', { description: state.error })
    } else if (state?.success) {
      toast.success('Notification preferences updated')
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          key={`${emailNotificationsEnabled}|${smsNotificationsEnabled}|${inAppNotificationsEnabled}|${notificationPreference}`}
          action={action}
          className="space-y-4"
        >
          <input type="hidden" name="userId" value={userId} />

          <div className="space-y-2">
            <Label htmlFor="notificationPreference">Notification Level</Label>
            <select
              id="notificationPreference"
              name="notificationPreference"
              defaultValue={notificationPreference}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Notifications</option>
              <option value="important">Important Only</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="space-y-2 rounded-md border border-input p-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="emailNotificationsEnabled"
                  defaultChecked={emailNotificationsEnabled}
                  className="rounded"
                />
                Email Notifications
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="smsNotificationsEnabled"
                  defaultChecked={smsNotificationsEnabled}
                  className="rounded"
                />
                SMS Notifications
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="inAppNotificationsEnabled"
                  defaultChecked={inAppNotificationsEnabled}
                  className="rounded"
                />
                In-App Notifications
              </label>
            </div>
          </div>

          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
