import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTasksForView } from '@/lib/tasks/read'
import { TaskList } from '@/components/tasks/TaskList'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export async function TasksPage({ mode, userId, roles, organization = false }: { mode: 'admin' | 'staff' | 'sales'; userId: string; roles: string[]; organization?: boolean }) {
  const canViewOrganization = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  const tasks = await getTasksForView({ userId, roles, includeOrganization: organization && canViewOrganization })
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
      {canViewOrganization ? (
        <div className="flex gap-2 text-sm">
          <Link href={`/${mode}/tasks`} className={`rounded-lg px-3 py-2 ${!organization ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Assigned to me</Link>
          <Link href={`/${mode}/tasks?scope=organization`} className={`rounded-lg px-3 py-2 ${organization ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Organization</Link>
        </div>
      ) : null}
      <Card><CardContent className="p-4 sm:p-6"><TaskList items={tasks} mode={mode} nowIso={nowIso} /></CardContent></Card>
    </div>
  )
}
