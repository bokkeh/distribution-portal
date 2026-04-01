'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Pin, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { addAccountNote, deleteAccountNote, updateAccountNote } from '@/actions/crm-account'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccountNoteItem } from '@/lib/crm/account-detail-data'
import { formatDate } from '@/lib/utils'

const NOTE_TYPES = [
  { value: 'general_update', label: 'General update' },
  { value: 'call_note', label: 'Call note' },
  { value: 'delivery_note', label: 'Delivery note' },
  { value: 'tasting_note', label: 'Tasting note' },
  { value: 'account_issue', label: 'Account issue' },
  { value: 'billing_note', label: 'Billing note' },
] as const

type EditingState = {
  id: string
  noteBody: string
  noteType: string
  isPinned: boolean
} | null

export function AccountNotesCard({
  accountId,
  notes,
  currentUserId,
  currentUserRoles,
}: {
  accountId: string
  notes: AccountNoteItem[]
  currentUserId: string | undefined
  currentUserRoles: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('general_update')
  const [isPinned, setIsPinned] = useState(false)
  const [editing, setEditing] = useState<EditingState>(null)

  const canManageAll = currentUserRoles.includes('admin') || currentUserRoles.includes('staff')

  function canManageNote(note: AccountNoteItem) {
    return canManageAll || (currentUserId && note.authorUserId === currentUserId)
  }

  function refreshWithToast(message: string) {
    toast.success(message)
    router.refresh()
  }

  function handleAddNote() {
    const formData = new FormData()
    formData.append('accountId', accountId)
    formData.append('noteBody', noteBody)
    formData.append('noteType', noteType)
    if (isPinned) formData.append('isPinned', 'on')

    startTransition(async () => {
      try {
        await addAccountNote(formData)
        setNoteBody('')
        setNoteType('general_update')
        setIsPinned(false)
        refreshWithToast('Note added')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add note')
      }
    })
  }

  function handleUpdateNote() {
    if (!editing) return

    const formData = new FormData()
    formData.append('noteBody', editing.noteBody)
    formData.append('noteType', editing.noteType)
    if (editing.isPinned) formData.append('isPinned', 'on')

    startTransition(async () => {
      const result = await updateAccountNote(editing.id, formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setEditing(null)
      refreshWithToast('Note updated')
    })
  }

  function handleDeleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return

    startTransition(async () => {
      const result = await deleteAccountNote(noteId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      refreshWithToast('Note deleted')
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3">
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Add internal account context, call notes, tasting feedback, or operational updates."
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400"
            />
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <select
                value={noteType}
                onChange={(event) => setNoteType(event.target.value)}
                className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
              >
                {NOTE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />
                Pin note
              </label>
              <Button type="button" disabled={isPending || !noteBody.trim()} onClick={handleAddNote}>
                {isPending ? 'Saving...' : 'Add Note'}
              </Button>
            </div>
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">No internal notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const isEditing = editing?.id === note.id
              return (
                <div key={note.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editing.noteBody}
                        onChange={(event) => setEditing((current) => current ? { ...current, noteBody: event.target.value } : current)}
                        className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                      />
                      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                        <select
                          value={editing.noteType}
                          onChange={(event) => setEditing((current) => current ? { ...current, noteType: event.target.value } : current)}
                          className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
                        >
                          {NOTE_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={editing.isPinned}
                            onChange={(event) => setEditing((current) => current ? { ...current, isPinned: event.target.checked } : current)}
                          />
                          Pin note
                        </label>
                        <Button type="button" disabled={isPending || !editing.noteBody.trim()} onClick={handleUpdateNote}>
                          {isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                          <X className="mr-2 h-4 w-4" />Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={note.isPinned ? 'warning' : 'secondary'}>
                              {NOTE_TYPES.find((option) => option.value === note.noteType)?.label ?? note.noteType}
                            </Badge>
                            {note.isPinned ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                                <Pin className="h-3.5 w-3.5" />Pinned
                              </span>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{note.noteBody}</p>
                        </div>
                        {canManageNote(note) ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditing({
                                id: note.id,
                                noteBody: note.noteBody,
                                noteType: note.noteType,
                                isPinned: note.isPinned,
                              })}
                              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              title="Edit note"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs text-slate-500" suppressHydrationWarning>
                        {note.authorName ?? 'System'}{note.authorRole ? ` (${note.authorRole})` : ''} • {formatDate(note.createdAt)}
                        {note.updatedAt.getTime() !== note.createdAt.getTime() ? ` • Edited ${formatDate(note.updatedAt)}` : ''}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
