import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'
import { IndustryNewsPreferencesCard } from '@/components/news/IndustryNewsPreferencesCard'
import { getUserPreferences } from '@/lib/preferences/read'

export default async function SalesNewsPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const preferences = await getUserPreferences(session.user.id)

  return (
    <div className="space-y-6">
      <IndustryNewsPreferencesCard
        userId={session.user.id}
        preferences={{
          newsNotificationsMuted: preferences.newsNotificationsMuted ?? false,
          newsDigestFrequency: preferences.newsDigestFrequency ?? 'important_only',
          newsEmailEnabled: preferences.newsEmailEnabled ?? true,
          newsSmsEnabled: preferences.newsSmsEnabled ?? false,
          newsInAppEnabled: preferences.newsInAppEnabled ?? true,
        }}
      />
      <IndustryNewsFeedPage audience="sales" />
    </div>
  )
}
