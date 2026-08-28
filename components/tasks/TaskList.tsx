'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Clock3, Pencil, Trash2 } from 'lucide-react'
import { deleteTask, updateTaskDetails, updateTaskStatus } from '@/actions/tasks'
import type { TaskListItem } from '@/lib/tasks/read'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function accountHref(mode: 'admin' | 'staff' | 'sales', accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}` : `/${mode}/crm/${accountId}`
}

export function TaskList({ items, mode, compact = false, nowIso }: { items: TaskListItem[]; mode: 'admin' | 'staff' | 'sales'; compact?: boolean; nowIso: string }) {
  const [tasks, setTasks] = useState(items)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const visible = useMemo(() => compact ? tasks.filter((task) => !['completed', 'cancelled'].includes(task.status)).slice(0, 8) : tasks, [compact, tasks])

  function changeStatus(task: TaskListItem, status: TaskListItem['status']) {
    setPendingId(task.id)
    setError(null)
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, status)
      if (result.error) setError(result.error)
      else setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status, completedAt: status === 'completed' ? new Date().toISOString() : null } : item))
      setPendingId(null)
    })
  }

  function removeTask(task: TaskListItem) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return
    setPendingId(task.id)
    setError(null)
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.error) setError(result.error)
      else setTasks((current) => current.filter((item) => item.id !== task.id))
      setPendingId(null)
    })
  }

  function saveDetails(task: TaskListItem, formData: FormData) {
    setPendingId(task.id)
    setError(null)
    const dueAt = new Date(String(formData.get('dueAt'))).toISOString()
    startTransition(async () => {
      const title = String(formData.get('title') ?? '')
      const description = String(formData.get('description') ?? '')
      const priority = String(formData.get('priority') ?? 'normal') as TaskListItem['priority']
      const result = await updateTaskDetails({ taskId: task.id, title, description, priority, dueAt, assignedToUserId: task.assignedToUserId })
      if (result.error) setError(result.error)
      else {
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, title, description: description || null, priority, dueAt } : item))
        setEditingId(null)
      }
      setPendingId(null)
    })
  }

  if (!visible.length) return <p className="text-sm text-slate-500">No tasks in this view.</p>

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {visible.map((task) => {
        const due = new Date(task.dueAt)
        const overdue = !['completed', 'cancelled'].includes(task.status) && due.getTime() < new Date(nowIso).getTime()
        return (
          <article key={task.id} id={`task-${task.id}`} className={`rounded-2xl border p-4 ${overdue ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'warning' : 'outline'} className="capitalize">{task.priority}</Badge>
                  <Badge variant={task.status === 'completed' ? 'success' : overdue ? 'destructive' : 'secondary'} className="capitalize">{task.status.replace('_', ' ')}</Badge>
                </div>
                {task.description && !compact ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p> : null}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{due.toLocaleString()}</span>
                  {task.accountId && task.accountName ? <Link href={accountHref(mode, task.accountId)} className="font-medium text-blue-600 hover:underline">{task.accountName}</Link> : null}
                  <span>Assigned to {task.assigneeName}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!compact ? <Button type="button" size="sm" variant="outline" onClick={() => setEditingId((current) => current === task.id ? null : task.id)}><Pencil className="mr-1 h-4 w-4" />Edit</Button> : null}
                {!compact ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeTask(task)}
                    disabled={pendingId === task.id}
                    aria-label={`Delete ${task.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
                {task.status !== 'completed' && task.status !== 'cancelled' ? (
                  <Button type="button" size="sm" onClick={() => changeStatus(task, 'completed')} disabled={pendingId === task.id}>
                    <Check className="mr-1 h-4 w-4" /> Complete
                  </Button>
                ) : null}
                {!compact ? (
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    disabled={pendingId === task.id}
                    onChange={(event) => changeStatus(task, event.target.value as TaskListItem['status'])}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                ) : null}
              </div>
            </div>
            {editingId === task.id ? (
              <form action={(formData) => saveDetails(task, formData)} className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                <input name="title" defaultValue={task.title} required className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                <input name="dueAt" type="datetime-local" defaultValue={new Date(new Date(task.dueAt).getTime() - new Date(task.dueAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)} required className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                <textarea name="description" defaultValue={task.description ?? ''} className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
                <select name="priority" defaultValue={task.priority} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
                <Button type="submit" disabled={pendingId === task.id}>Save changes</Button>
              </form>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
