'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { TaskListItem } from '@/lib/tasks/read'
import { TaskList } from '@/components/tasks/TaskList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TaskDashboardModule({ tasks, mode, nowIso }: { tasks: TaskListItem[]; mode: 'admin' | 'staff' | 'sales'; nowIso: string }) {
  const active = tasks.filter((task) => !['completed', 'cancelled'].includes(task.status))
  const overdue = active.filter((task) => new Date(task.dueAt).getTime() < new Date(nowIso).getTime()).length
  const todayKey = new Date(nowIso).toDateString()
  const today = active.filter((task) => new Date(task.dueAt).toDateString() === todayKey).length
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Tasks</CardTitle>
          <p className="mt-1 text-xs text-slate-500">{overdue} overdue · {today} due today · {active.length} open</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('quick-add:open', { detail: { action: 'task' } }))}>
            <Plus className="mr-1 h-4 w-4" /> Task
          </Button>
          <Button asChild size="sm" variant="ghost"><Link href={`/${mode}/tasks`}>View all</Link></Button>
        </div>
      </CardHeader>
      <CardContent><TaskList items={tasks} mode={mode} compact nowIso={nowIso} /></CardContent>
    </Card>
  )
}
