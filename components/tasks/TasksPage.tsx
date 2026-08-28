import { asc, eq } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { TASK_ROLES } from '@/lib/tasks/roles'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getTasksForView } from '@/lib/tasks/read'
import { TasksScopeTabs } from '@/components/tasks/TasksScopeTabs'
import { Button } from '@/components/ui/button'

export async function TasksPage({ mode, userId, roles, organization = false }: { mode: 'admin' | 'staff' | 'sales'; userId: string; roles: string[]; organization?: boolean }) {
  const canViewOrganization = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  const canReassign = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  const [assignedToMeTasks, organizationTasks, assigneeRows] = await Promise.all([
    getTasksForView({ userId, roles, includeOrganization: false }),
    canViewOrganization ? getTasksForView({ userId, roles, includeOrganization: true }) : Promise.resolve([]),
    canReassign
      ? db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(eq(users.active, true)).orderBy(asc(users.name))
      : Promise.resolve([]),
  ])
  const assigneeOptions = assigneeRows
    .filter((user) => user.roles.some((role) => TASK_ROLES.includes(role as typeof TASK_ROLES[number])))
    .map((user) => ({ id: user.id, name: user.name ?? 'Unnamed user' }))
  const nowIso = new Date().toISOString()
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">CRM Tasks</h1>
          <p className="mt-2 text-sm text-slate-600">Manage follow-ups, assignments, reminders, and account work.</p>
        </div>
        <Button type="button" data-quick-add-action="task"><Plus className="mr-2 h-4 w-4" />Add Task</Button>
      </div>
      <TasksScopeTabs
        mode={mode}
        nowIso={nowIso}
        canViewOrganization={canViewOrganization}
        initialOrganization={organization}
        assignedToMeTasks={assignedToMeTasks}
        organizationTasks={organizationTasks}
        assigneeOptions={assigneeOptions}
        canReassign={canReassign}
      />
    </div>
  )
}
