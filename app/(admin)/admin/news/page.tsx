import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'
import { IndustryNewsPreferencesCard } from '@/components/news/IndustryNewsPreferencesCard'
import { IndustryNewsSourceManagerCard } from '@/components/news/IndustryNewsSourceManagerCard'
import { getIndustryNewsSourcesWithStats } from '@/lib/industry-news'
import { getUserPreferences } from '@/lib/preferences/read'

export default async function AdminNewsPage() {
  const session = await requireRole('admin')
  const [preferences, sources] = await Promise.all([
    getUserPreferences(session.user.id),
    getIndustryNewsSourcesWithStats(),
  ])

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
        <IndustryNewsSourceManagerCard sources={sources} />
      </div>
      <IndustryNewsFeedPage audience="admin" />
    </div>
  )
}
