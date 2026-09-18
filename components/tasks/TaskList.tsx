'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Clock3, Pencil, Trash2 } from 'lucide-react'
import { deleteTask, updateTaskDetails, updateTaskStatus } from '@/actions/tasks'
import type { TaskListItem } from '@/lib/tasks/read'
import { sortTasks } from '@/lib/tasks/sort'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function accountHref(mode: 'admin' | 'staff' | 'sales', accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}` : `/${mode}/crm/${accountId}`
}

export function TaskList({ items, mode, compact = false, nowIso, assigneeOptions = [], canReassign = false }: {
  items: TaskListItem[]
  mode: 'admin' | 'staff' | 'sales'
  compact?: boolean
  nowIso: string
  assigneeOptions?: Array<{ id: string; name: string }>
  canReassign?: boolean
}) {
  const [localTasks, setLocalTasks] = useState<{ source: TaskListItem[]; items: TaskListItem[] }>({ source: items, items })
  const tasks = localTasks.source === items ? localTasks.items : items
  function setTasks(update: (current: TaskListItem[]) => TaskListItem[]) {
    setLocalTasks(current => ({ source: items, items: update(current.source === items ? current.items : items) }))
  }
  const [showCompleted, setShowCompleted] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const visible = useMemo(() => {
    const sorted = sortTasks(tasks)
    return compact ? sorted.filter(task => !['completed', 'cancelled'].includes(task.status)).slice(0, 8) : sorted.filter(task => showCompleted || task.status !== 'completed')
  }, [compact, tasks, showCompleted])

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
      const assignedToUserId = canReassign ? String(formData.get('assignedToUserId') ?? task.assignedToUserId) : task.assignedToUserId
      const result = await updateTaskDetails({ taskId: task.id, title, description, priority, dueAt, assignedToUserId })
      if (result.error) setError(result.error)
      else {
        const assigneeName = assigneeOptions.find((option) => option.id === assignedToUserId)?.name ?? task.assigneeName
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, title, description: description || null, priority, dueAt, assignedToUserId, assigneeName } : item))
        setEditingId(null)
      }
      setPendingId(null)
    })
  }


  return (
    <div className="space-y-0">
      {!compact ? <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm text-slate-500">{tasks.filter(task => task.status === 'completed').length} completed</p><Button type="button" size="sm" variant="outline" aria-pressed={showCompleted} onClick={() => setShowCompleted(value => !value)}>{showCompleted ? 'Hide Completed' : 'Show Completed'}</Button></div> : null}
      {!visible.length ? <p className="py-3 text-sm text-slate-500">No tasks in this view.</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {visible.map((task, index) => {
        const due = new Date(task.dueAt)
        const overdue = !['completed', 'cancelled'].includes(task.status) && due.getTime() < new Date(nowIso).getTime()
        return (
          <article key={task.id} id={`task-${task.id}`} className={`border-b px-3 py-2 ${overdue ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
            <>{task.status === 'completed' && visible[index - 1]?.status !== 'completed' ? <p className="border-b py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Completed tasks</p> : null}</>
            <div className="flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 lg:flex-nowrap">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-slate-900" title={task.title}>{task.title}</p>
                  <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'warning' : 'outline'} className="capitalize">{task.priority}</Badge>
                  <Badge variant={task.status === 'completed' ? 'success' : overdue ? 'destructive' : 'secondary'} className="capitalize">{task.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{due.toLocaleString()}</span>
                  {task.accountId && task.accountName ? <Link href={accountHref(mode, task.accountId)} className="font-medium text-blue-600 hover:underline">{task.accountName}</Link> : null}
                  <span>Assigned to {task.assigneeName}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!compact ? <Button type="button" size="sm" variant="ghost" aria-expanded={detailsId === task.id} onClick={() => setDetailsId(current => current === task.id ? null : task.id)}>Details</Button> : null}
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
            {!compact && detailsId === task.id ? <div className="space-y-1 py-2 text-sm text-slate-600">{task.description ? <p className="whitespace-pre-wrap">{task.description}</p> : null}<p>Created by {task.createdByName}{task.contactName ? ` · Contact: ${task.contactName}` : ''}</p>{task.completedAt ? <p>Completed: {new Date(task.completedAt).toLocaleString()}</p> : null}</div> : null}
            {editingId === task.id ? (
              <form action={(formData) => saveDetails(task, formData)} className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                <input name="title" defaultValue={task.title} required className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                <input name="dueAt" type="datetime-local" defaultValue={new Date(new Date(task.dueAt).getTime() - new Date(task.dueAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)} required className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                <textarea name="description" defaultValue={task.description ?? ''} className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
                <select name="priority" defaultValue={task.priority} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
                {canReassign ? (
                  <select name="assignedToUserId" defaultValue={task.assignedToUserId} className="h-10 rounded-lg border border-slate-200 px-3 text-sm sm:col-span-2">
                    {assigneeOptions.some((option) => option.id === task.assignedToUserId)
                      ? null
                      : <option value={task.assignedToUserId}>{task.assigneeName}</option>}
                    {assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                ) : null}
                <Button type="submit" disabled={pendingId === task.id}>Save changes</Button>
              </form>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
