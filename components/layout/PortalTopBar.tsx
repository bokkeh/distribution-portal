import { PortalBreadcrumbs } from './PortalBreadcrumbs'
import { PortalSearch } from '@/components/search/PortalSearch'
import { NotificationBell, type NotificationItem } from '@/components/notifications/NotificationBell'
import { PortalProfileMenu } from '@/components/layout/PortalProfileMenu'
import { GlobalQuickAdd } from '@/components/quick-add/GlobalQuickAdd'

export function PortalTopBar({
  operational = false,
  notifications = [],
  unreadCount = 0,
  userName,
  userAvatarUrl,
  profileHref,
  canSwitchViews = false,
}: {
  operational?: boolean
  notifications?: NotificationItem[]
  unreadCount?: number
  userName?: string | null
  userAvatarUrl?: string | null
  profileHref?: string | null
  canSwitchViews?: boolean
}) {
  if (operational) {
    return (
      <header className="sticky top-14 z-30 border-b border-slate-300 bg-[hsl(var(--background))] px-4 py-3 text-slate-950 md:top-0 md:px-6">
        <div className="absolute right-4 top-2.5 md:hidden"><GlobalQuickAdd compact /></div>
        <div className="grid items-center gap-3 md:grid-cols-[minmax(15rem,1.2fr)_minmax(18rem,2fr)_auto] md:gap-5">
          <div className="min-w-0 overflow-hidden">
            <PortalBreadcrumbs operational />
          </div>
          <PortalSearch operational />
          <div className="hidden items-center justify-end gap-3 md:flex">
            <GlobalQuickAdd />
            <NotificationBell items={notifications} unreadCount={unreadCount} topBar />
            <PortalProfileMenu
              userName={userName}
              userAvatarUrl={userAvatarUrl}
              profileHref={profileHref}
              canSwitchViews={canSwitchViews}
            />
          </div>
        </div>
      </header>
    )
  }

  return (
    <div className="mb-6 space-y-4">
      <PortalBreadcrumbs />
      <PortalSearch />
    </div>
  )
}
