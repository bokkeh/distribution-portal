'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { BellRing } from 'lucide-react'
import { updateIndustryNewsPreferences } from '@/actions/industry-news'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export function IndustryNewsPreferencesCard({
  userId,
  preferences,
}: {
  userId: string
  preferences: {
    newsNotificationsMuted: boolean
    newsDigestFrequency: string
    newsEmailEnabled: boolean
    newsSmsEnabled: boolean
    newsInAppEnabled: boolean
  }
}) {
  const [state, action, pending] = useActionState(updateIndustryNewsPreferences, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to save news settings', { description: state.error })
    } else if (state?.success) {
      toast.success('News settings updated')
    }
  }, [state])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-slate-400" />
          News Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          key={`${preferences.newsNotificationsMuted}|${preferences.newsDigestFrequency}|${preferences.newsEmailEnabled}|${preferences.newsSmsEnabled}|${preferences.newsInAppEnabled}`}
          action={action}
          className="space-y-4"
        >
          <input type="hidden" name="userId" value={userId} />

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input type="checkbox" name="newsNotificationsMuted" defaultChecked={preferences.newsNotificationsMuted} />
            Mute all Industry News notifications
          </label>

          <div className="space-y-2">
            <Label htmlFor="newsDigestFrequency">Delivery Mode</Label>
            <select
              id="newsDigestFrequency"
              name="newsDigestFrequency"
              defaultValue={preferences.newsDigestFrequency}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="important_only">Important only</option>
              <option value="urgent_only">Urgent only</option>
              <option value="daily_digest">Daily digest</option>
              <option value="weekly_digest">Weekly digest</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>News Channels</Label>
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="newsEmailEnabled" defaultChecked={preferences.newsEmailEnabled} />
                Email
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="newsSmsEnabled" defaultChecked={preferences.newsSmsEnabled} />
                SMS
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="newsInAppEnabled" defaultChecked={preferences.newsInAppEnabled} />
                In-app
              </label>
            </div>
          </div>

          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? 'Saving...' : 'Save News Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
