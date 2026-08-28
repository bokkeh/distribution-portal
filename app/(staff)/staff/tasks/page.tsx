import { requireAdminOrStaff } from '@/lib/auth/session'
import { TasksPage } from '@/components/tasks/TasksPage'

export default async function StaffTasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const [session, params] = await Promise.all([requireAdminOrStaff(), searchParams])
  return <TasksPage mode="staff" userId={session.user.id} roles={session.user.roles ?? [session.user.role as string]} organization={params.scope === 'organization'} />
}
