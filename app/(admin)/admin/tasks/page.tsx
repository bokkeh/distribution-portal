import { requireAdmin } from '@/lib/auth/session'
import { TasksPage } from '@/components/tasks/TasksPage'

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const [session, params] = await Promise.all([requireAdmin(), searchParams])
  return <TasksPage mode="admin" userId={session.user.id} roles={session.user.roles ?? [session.user.role as string]} organization={params.scope === 'organization'} />
}
