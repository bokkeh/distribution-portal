'use client'

import { useEffect, useRef, useState } from 'react'
import { createFieldTask, getFieldAccount, getFieldAccountTasks, getFieldMyTasks, setFieldTaskStatus } from '@/actions/field-data'
import { Button } from '@/components/ui/button'

type Account = Awaited<ReturnType<typeof getFieldAccount>>
type Tasks = Awaited<ReturnType<typeof getFieldAccountTasks>>
type Task = Tasks['open'][number]
type MyTasks = Awaited<ReturnType<typeof getFieldMyTasks>>

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const priorityStyle: Record<Task['priority'], string> = { low: 'bg-stone-100 text-stone-700', normal: 'bg-sky-50 text-sky-800', high: 'bg-amber-50 text-amber-900', urgent: 'bg-red-50 text-red-800' }

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function defaultDue() {
  const due = new Date()
  due.setDate(due.getDate() + 1)
  due.setHours(9, 0, 0, 0)
  return localInputValue(due)
}

function formatDue(value: string) {
  return new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function TaskRow({ task, pending, onToggle, onOpenAccount }: { task: Task; pending: boolean; onToggle: () => void; onOpenAccount?: (accountId: string) => void }) {
  const done = task.status === 'completed'
  const overdue = !done && new Date(task.dueAt) < new Date()
  return <div className="space-y-2 rounded-xl border bg-white p-4">
    <div className="flex items-start gap-2">
      <h3 className={`min-w-0 flex-1 break-words text-lg font-semibold ${done ? 'text-muted-foreground line-through' : ''}`}>{task.title}</h3>
      <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${priorityStyle[task.priority]}`}>{task.priority}</span>
    </div>
    {task.description ? <p className="whitespace-pre-wrap break-words text-sm">{task.description}</p> : null}
    <p className={`text-sm ${overdue ? 'font-semibold text-red-700' : 'text-muted-foreground'}`}>{done && task.completedAt ? `Completed ${formatDue(task.completedAt)}` : `${overdue ? 'Overdue · ' : 'Due '}${formatDue(task.dueAt)}`}</p>
    <p className="break-words text-sm text-muted-foreground">{task.assigneeName}{task.contactName ? ` · with ${task.contactName}` : ''}</p>
    {onOpenAccount ? task.accountId ? <button type="button" disabled={pending} onClick={() => onOpenAccount(task.accountId!)} className="flex min-h-12 w-full items-center break-words rounded-xl border bg-orange-50 px-3 text-left text-sm font-semibold">Open account · {task.accountName ?? 'Account'}</button> : <p className="text-sm text-muted-foreground">General task · no account</p> : null}
    <Button type="button" variant={done ? 'outline' : 'default'} className="h-12 w-full" disabled={pending} aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`} onClick={onToggle}>{done ? 'Reopen task' : 'Mark complete'}</Button>
  </div>
}

function FieldTaskForm({ account, tasks, onCancel, onSaved }: { account?: Account; tasks: Pick<Tasks, 'currentUserId' | 'assignees'>; onCancel: () => void; onSaved: (tasks: Tasks | null) => void }) {
  const locked = useRef(false), requestId = useRef<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', due: defaultDue(), priority: 'normal' as Task['priority'], contactId: '', assignedToUserId: tasks.currentUserId })
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const update = (patch: Partial<typeof form>) => { requestId.current = null; setForm(previous => ({ ...previous, ...patch })) }
  const field = 'mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base'
  return <form className="space-y-4 rounded-2xl border bg-white p-4" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    const due = new Date(form.due)
    if (Number.isNaN(due.getTime())) { setError('Choose a due date and time.'); return }
    locked.current = true; setPending(true); setError('')
    try {
      requestId.current ??= crypto.randomUUID()
      const result = await createFieldTask({ requestId: requestId.current, accountId: account?.id ?? '', title: form.title, description: form.description, dueAt: due.toISOString(), priority: form.priority, contactId: form.contactId, assignedToUserId: form.assignedToUserId })
      if ('error' in result) { setError(result.error ?? 'Could not save this task.'); return }
      requestId.current = null
      onSaved(result.tasks)
    } catch { setError('Could not confirm task save. Your details are kept; retry.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <h2 className="text-xl font-semibold">New task</h2>{account ? null : <p className="text-sm text-muted-foreground">General to-do, not linked to an account. To link one, add it from that account’s Tasks screen.</p>}
    <label className="block">What needs to be done?<input value={form.title} onChange={event => update({ title: event.target.value })} required maxLength={200} disabled={pending} placeholder="Follow up on reorder, drop off samples…" className={field} /></label>
    <label className="block">Details (optional)<textarea value={form.description} onChange={event => update({ description: event.target.value })} maxLength={4000} disabled={pending} className="mt-2 min-h-28 w-full rounded-xl border bg-white p-4 text-base" /></label>
    <label className="block">Due<input type="datetime-local" value={form.due} onChange={event => update({ due: event.target.value })} required disabled={pending} className={field} /></label>
    <fieldset><legend>Priority</legend><div className="mt-2 grid grid-cols-4 gap-2">{PRIORITIES.map(priority => <button key={priority} type="button" disabled={pending} aria-pressed={form.priority === priority} onClick={() => update({ priority })} className={`h-12 rounded-xl border text-sm font-semibold capitalize ${form.priority === priority ? 'border-orange-500 bg-orange-50' : 'bg-white'}`}>{priority}</button>)}</div></fieldset>
    <label className="block">Assign to<select value={form.assignedToUserId} onChange={event => update({ assignedToUserId: event.target.value })} disabled={pending} className={field}>{tasks.assignees.map(person => <option key={person.id} value={person.id}>{person.id === tasks.currentUserId ? `Me (${person.name})` : person.name}</option>)}</select></label>
    {account?.contacts.length ? <label className="block">Related contact (optional)<select value={form.contactId} onChange={event => update({ contactId: event.target.value })} disabled={pending} className={field}><option value="">No specific contact</option>{account.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label> : null}
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <Button className="h-14 w-full text-base" disabled={pending}>{pending ? 'Saving…' : 'Save task'}</Button>
    <Button type="button" variant="ghost" className="h-12 w-full" disabled={pending} onClick={onCancel}>Cancel adding task</Button>
  </form>
}

export function FieldTasks({ account }: { account: Account }) {
  const [tasks, setTasks] = useState<Tasks | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0), [adding, setAdding] = useState(false), [pendingId, setPendingId] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try { const result = await getFieldAccountTasks(account.id); if (active) setTasks(result) }
      catch { if (active) setError('Could not refresh this account’s tasks. Check your connection and retry.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [account.id, refresh])
  async function toggle(task: Task) {
    if (pendingId) return
    setPendingId(task.id); setError(''); setMessage('')
    try {
      const result = await setFieldTaskStatus(account.id, task.id, task.status === 'completed' ? 'open' : 'completed')
      if ('error' in result) { setError(result.error ?? 'Could not update this task.'); return }
      if (result.tasks) setTasks(result.tasks); setMessage(task.status === 'completed' ? `${task.title} reopened.` : `${task.title} completed.`)
    } catch { setError('Could not confirm the task update. Refresh tasks and retry.') }
    finally { setPendingId(null) }
  }
  if (adding && tasks) return <FieldTaskForm account={account} tasks={tasks} onCancel={() => setAdding(false)} onSaved={next => { if (next) setTasks(next); setAdding(false); setMessage('Task saved to this account.') }} />
  return <section aria-label="Account tasks" className="space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Tasks</h2><Button type="button" variant="outline" className="h-12" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh tasks</Button></div>
    <Button type="button" className="h-14 w-full text-base" disabled={!tasks} onClick={() => { setAdding(true); setMessage('') }}>Add task</Button>
    {message ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p> : null}
    {loading ? <p role="status" className="text-sm">{tasks ? 'Refreshing tasks…' : 'Loading tasks…'}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}{tasks ? ' Tasks below are from the last successful refresh.' : ''}</p> : null}
    {tasks ? <>
      <div className="space-y-2"><h3 className="font-semibold">Open ({tasks.open.length})</h3>{tasks.open.length ? tasks.open.map(task => <TaskRow key={task.id} task={task} pending={pendingId !== null} onToggle={() => toggle(task)} />) : <p className="text-sm text-muted-foreground">No open tasks for this account.</p>}</div>
      {tasks.completed.length ? <div className="space-y-2"><h3 className="font-semibold">Recently completed</h3>{tasks.completed.map(task => <TaskRow key={task.id} task={task} pending={pendingId !== null} onToggle={() => toggle(task)} />)}</div> : null}
    </> : null}
  </section>
}

function startOfDay(date: Date) { const day = new Date(date); day.setHours(0, 0, 0, 0); return day }

/** Every task the portal Tasks page shows, across accounts, for use between client visits. */
export function FieldMyTasks({ onOpenAccount }: { onOpenAccount: (accountId: string) => Promise<void> }) {
  const [tasks, setTasks] = useState<MyTasks | null>(null), [scope, setScope] = useState<'mine' | 'everyone'>('mine')
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0), [adding, setAdding] = useState(false), [pendingId, setPendingId] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try { const result = await getFieldMyTasks(scope); if (active) setTasks(result) }
      catch { if (active) setError('Could not refresh your tasks. Check your connection and retry.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [scope, refresh])
  async function toggle(task: Task) {
    if (pendingId) return
    setPendingId(task.id); setError(''); setMessage('')
    try {
      const result = await setFieldTaskStatus(null, task.id, task.status === 'completed' ? 'open' : 'completed')
      if ('error' in result) { setError(result.error ?? 'Could not update this task.'); return }
      setMessage(task.status === 'completed' ? `${task.title} reopened.` : `${task.title} completed.`); setRefresh(value => value + 1)
    } catch { setError('Could not confirm the task update. Refresh tasks and retry.') }
    finally { setPendingId(null) }
  }
  async function openAccount(accountId: string) {
    setPendingId(accountId); setError('')
    try { await onOpenAccount(accountId) }
    catch { setError('Could not open this account. You may not be assigned to it; ask a manager, or retry.') }
    finally { setPendingId(null) }
  }
  if (adding && tasks) return <FieldTaskForm tasks={tasks} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); setMessage('Task saved.'); setRefresh(value => value + 1) }} />
  const today = startOfDay(new Date()), tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const groups = tasks ? [
    { title: 'Overdue', rows: tasks.open.filter(task => new Date(task.dueAt) < today) },
    { title: 'Today', rows: tasks.open.filter(task => new Date(task.dueAt) >= today && new Date(task.dueAt) < tomorrow) },
    { title: 'Upcoming', rows: tasks.open.filter(task => new Date(task.dueAt) >= tomorrow) },
  ] : []
  const row = (task: Task) => <TaskRow key={task.id} task={task} pending={pendingId !== null} onToggle={() => toggle(task)} onOpenAccount={openAccount} />
  return <section aria-label="My tasks" className="space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">{scope === 'everyone' ? 'Everyone’s tasks' : 'My tasks'}</h2><Button type="button" variant="outline" className="h-12" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh tasks</Button></div>
    <p className="text-sm text-muted-foreground">Same list as the portal Tasks page, across every account.</p>
    {tasks?.canViewEveryone ? <div className="grid grid-cols-2 gap-2">{(['mine', 'everyone'] as const).map(value => <button key={value} type="button" aria-pressed={scope === value} disabled={loading} onClick={() => setScope(value)} className={`h-12 rounded-xl border font-semibold ${scope === value ? 'border-orange-500 bg-orange-50' : 'bg-white'}`}>{value === 'mine' ? 'Mine' : 'Everyone'}</button>)}</div> : null}
    <Button type="button" className="h-14 w-full text-base" disabled={!tasks} onClick={() => { setAdding(true); setMessage('') }}>Add general task</Button>
    {message ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p> : null}
    {loading ? <p role="status" className="text-sm">{tasks ? 'Refreshing tasks…' : 'Loading tasks…'}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}{tasks ? ' Tasks below are from the last successful refresh.' : ''}</p> : null}
    {tasks ? <>
      {tasks.open.length ? groups.filter(group => group.rows.length).map(group => <div key={group.title} className="space-y-2"><h3 className={`font-semibold ${group.title === 'Overdue' ? 'text-red-700' : ''}`}>{group.title} ({group.rows.length})</h3>{group.rows.map(row)}</div>) : <p className="text-sm text-muted-foreground">No open tasks. Nice work.</p>}
      {tasks.completed.length ? <div className="space-y-2"><h3 className="font-semibold">Recently completed</h3>{tasks.completed.map(row)}</div> : null}
    </> : null}
  </section>
}

/** Home-screen entry point with a live open/overdue count. */
export function FieldMyTasksButton({ onOpen }: { onOpen: () => void }) {
  const [counts, setCounts] = useState<{ open: number; overdue: number } | null>(null)
  useEffect(() => {
    let active = true
    getFieldMyTasks('mine').then(result => { if (active) setCounts({ open: result.open.length, overdue: result.open.filter(task => new Date(task.dueAt) < new Date()).length }) }).catch(() => {})
    return () => { active = false }
  }, [])
  return <button type="button" onClick={onOpen} aria-label="My tasks" className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm active:bg-orange-50">
    <span><span className="block text-lg font-bold">My tasks</span><span className="block text-sm text-muted-foreground">Follow-ups across all accounts</span></span>
    {counts ? <span className="text-right text-sm"><span className="block font-semibold">{counts.open} open</span>{counts.overdue ? <span className="block font-semibold text-red-700">{counts.overdue} overdue</span> : null}</span> : null}
  </button>
}
