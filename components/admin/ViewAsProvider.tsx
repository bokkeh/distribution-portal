import { cookies } from 'next/headers'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/config'
import { ViewAsBanner } from './ViewAsBanner'

const COOKIE_NAME = '__portal_view_as'

export async function ViewAsProvider() {
  const session = await auth()
  if (!session) return null

  const isAdmin = session.user.roles?.includes('admin')
  if (!isAdmin) return null

  const jar = await cookies()
  const viewAsUserId = jar.get(COOKIE_NAME)?.value

  if (viewAsUserId) {
    const [target] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, viewAsUserId))
      .limit(1)

    if (!target) return null

    return (
      <ViewAsBanner
        isViewAsMode={true}
        viewingAsName={target.name ?? 'Unknown'}
        viewingAsEmail={target.email ?? ''}
      />
    )
  }

  // Admin browsing without view-as — show the "Back to Admin" widget
  return <ViewAsBanner isViewAsMode={false} />
}
