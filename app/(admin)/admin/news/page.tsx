import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'
import { IndustryNewsPreferencesCard } from '@/components/news/IndustryNewsPreferencesCard'
import { IndustryNewsSourceManagerCard } from '@/components/news/IndustryNewsSourceManagerCard'
import { getIndustryNewsSourcesWithStats } from '@/lib/industry-news'
import { getUserPreferences } from '@/lib/preferences/read'

const tabs = [
  { id: 'feed', label: 'Industry News', href: '/admin/news' },
  { id: 'alerts', label: 'News Alerts', href: '/admin/news?tab=alerts' },
  { id: 'sources', label: 'Source Manager', href: '/admin/news?tab=sources' },
] as const

type AdminNewsPageProps = {
  searchParams: Promise<{
    tab?: string
  }>
}

export default async function AdminNewsPage({ searchParams }: AdminNewsPageProps) {
  const session = await requireRole('admin')
  const { tab } = await searchParams
  const activeTab = tab === 'alerts' || tab === 'sources' ? tab : 'feed'

  let content: React.ReactNode

  if (activeTab === 'alerts') {
    const preferences = await getUserPreferences(session.user.id)
    content = (
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
    )
  } else if (activeTab === 'sources') {
    const sources = await getIndustryNewsSourcesWithStats()
    content = <IndustryNewsSourceManagerCard sources={sources} />
  } else {
    content = <IndustryNewsFeedPage audience="admin" />
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">News Workspace</p>
            <p className="mt-1 text-sm text-slate-500">
              Keep the feed front and center, then switch into alerts or source controls when you need them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => {
              const isActive = activeTab === item.id
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={
                    isActive
                      ? 'inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white shadow-sm'
                      : 'inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900'
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      {content}
    </div>
  )
}
