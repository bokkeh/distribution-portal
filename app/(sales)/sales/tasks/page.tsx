import { requireRole } from '@/lib/auth/session'
import { TasksPage } from '@/components/tasks/TasksPage'

export default async function SalesTasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const [session, params] = await Promise.all([requireRole('sales_rep', 'sales_manager', 'admin'), searchParams])
  return <TasksPage mode="sales" userId={session.user.id} roles={session.user.roles ?? [session.user.role as string]} organization={params.scope === 'organization'} />
}
