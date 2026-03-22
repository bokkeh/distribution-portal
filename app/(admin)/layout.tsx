import { requireAdmin } from '@/lib/auth/session'
import AdminSidebar from '@/components/layout/AdminSidebar'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { db } from '@/db'
import { wholesaleAccountRequests, activityEvents } from '@/db/schema'
import { desc, eq, inArray, and } from 'drizzle-orm'

const TERMINAL_STATUSES = ['approved', 'rejected', 'resolved']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)

  let wholesalerRequestCount = 0
  try {
    const requests = await db.select({ id: wholesaleAccountRequests.id }).from(wholesaleAccountRequests)
    if (requests.length > 0) {
      const requestIds = requests.map(r => r.id)
      const latestEvents = await db
        .select({ entityId: activityEvents.entityId, metadata: activityEvents.metadata })
        .from(activityEvents)
        .where(and(eq(activityEvents.entityType, 'wholesale_request'), inArray(activityEvents.entityId, requestIds)))
        .orderBy(desc(activityEvents.createdAt))

      const latestStatusByRequest = new Map<string, string>()
      for (const event of latestEvents) {
        if (latestStatusByRequest.has(event.entityId)) continue
        const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {}
        const status = typeof meta.status === 'string' ? meta.status : 'new'
        latestStatusByRequest.set(event.entityId, status)
      }

      wholesalerRequestCount = requests.filter(r => {
        const status = latestStatusByRequest.get(r.id) ?? 'new'
        return !TERMINAL_STATUSES.includes(status)
      }).length
    }
  } catch {
    // table may not exist yet — fall back to 0
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar
        showViewSwitcher={isSuperAdmin}
        featureFlags={session.user.featureFlags}
        roles={session.user.roles}
        notifications={notifications}
        unreadCount={unreadCount}
        navCounts={{ '/admin/wholesale-requests': wholesalerRequestCount }}
      />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-4 sm:p-8">
          <PortalTopBar />
          {children}
        </div>
      </main>
    </div>
  )
}
