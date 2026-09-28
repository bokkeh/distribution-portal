type SortableTask = { id: string; status: string; dueAt: string }
export function sortTasks<T extends SortableTask>(tasks: T[]): T[] {
  const rank = (status: string) => status === 'completed' ? 2 : status === 'cancelled' ? 1 : 0
  return [...tasks].sort((a, b) => rank(a.status) - rank(b.status) || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() || a.id.localeCompare(b.id))
}
