'use client'

import { useState } from 'react'
import type { TaskListItem } from '@/lib/tasks/read'
import { TaskList } from '@/components/tasks/TaskList'
import { Card, CardContent } from '@/components/ui/card'

export function TasksScopeTabs({
  mode,
  nowIso,
  canViewOrganization,
  initialOrganization,
  assignedToMeTasks,
  organizationTasks,
  assigneeOptions,
  canReassign,
}: {
  mode: 'admin' | 'staff' | 'sales'
  nowIso: string
  canViewOrganization: boolean
  initialOrganization: boolean
  assignedToMeTasks: TaskListItem[]
  organizationTasks: TaskListItem[]
  assigneeOptions: Array<{ id: string; name: string }>
  canReassign: boolean
}) {
  const [organization, setOrganization] = useState(canViewOrganization && initialOrganization)

  function selectScope(next: boolean) {
    if (organization === next) return
    setOrganization(next)
    const url = `/${mode}/tasks${next ? '?scope=organization' : ''}`
    window.history.replaceState(null, '', url)
  }

  return (
    <>
      {canViewOrganization ? (
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={() => selectScope(false)} className={`rounded-lg px-3 py-2 ${!organization ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>My tasks</button>
          <button type="button" onClick={() => selectScope(true)} className={`rounded-lg px-3 py-2 ${organization ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Organization</button>
        </div>
      ) : null}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <TaskList
            key={organization ? 'organization' : 'assigned-to-me'}
            items={organization ? organizationTasks : assignedToMeTasks}
            mode={mode}
            nowIso={nowIso}
            assigneeOptions={assigneeOptions}
            canReassign={canReassign}
          />
        </CardContent>
      </Card>
    </>
  )
}
