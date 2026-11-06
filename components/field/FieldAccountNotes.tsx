'use client'

import { useEffect, useRef, useState } from 'react'
import { getFieldAccountNotes, saveFieldNote } from '@/actions/field-data'
import { Button } from '@/components/ui/button'

export function FieldAccountNotes({ accountId }: { accountId: string }) {
  const [notes, setNotes] = useState<Awaited<ReturnType<typeof getFieldAccountNotes>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [visibleCount, setVisibleCount] = useState(10)
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const requestId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const rows = await getFieldAccountNotes(accountId)
        if (active) setNotes(rows)
      } catch {
        if (active) setLoadError('Could not refresh account notes. Check your connection and retry.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [accountId, revision])

  return <div className="space-y-5">
    <section aria-label="Previous account notes" className="space-y-4 rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Account notes</h2>
        <Button type="button" variant="outline" className="h-12 shrink-0" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh notes</Button>
      </div>
      <p className="text-sm text-muted-foreground">Previous notes for this account, shared with the desktop portal. Pinned notes appear first, then newest notes.</p>
      {loading ? <p role="status" className="text-sm">{notes ? 'Refreshing notes...' : 'Loading account notes...'}</p> : null}
      {loadError ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{loadError}{notes ? ' Showing the last successfully loaded notes.' : ''}</p> : null}
      {notes?.slice(0, visibleCount).map(note => <article key={note.id} className="space-y-2 rounded-xl border bg-stone-50 p-4">
        {note.pinned ? <p className="text-xs font-semibold uppercase text-orange-700">Pinned note</p> : null}
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{note.body}</p>
        <p className="text-sm text-muted-foreground">{note.author || 'Team member'} · <time dateTime={new Date(note.occurredAt).toISOString()}>{new Date(note.occurredAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></p>
      </article>)}
      {notes && !notes.length && !loading && !loadError ? <p className="text-sm text-muted-foreground">No previous notes recorded for this account.</p> : null}
      {notes && notes.length > visibleCount ? <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setVisibleCount(count => count + 10)}>Show more notes ({notes.length - visibleCount} remaining)</Button> : null}
    </section>
    <form className="space-y-4 rounded-2xl border bg-white p-4" onSubmit={async event => {
      event.preventDefault()
      if (locked.current) return
      locked.current = true; setPending(true); setMessage('')
      try {
        requestId.current ??= crypto.randomUUID()
        const result = await saveFieldNote(accountId, text, requestId.current)
        if (result.error) { setMessage(result.error); return }
        requestId.current = null; setText(''); setMessage('Note saved to this account.'); setRevision(value => value + 1)
      } catch { setMessage('Could not confirm save. Your note is kept; retry the same entry.') }
      finally { locked.current = false; setPending(false) }
    }}>
      <h3 className="text-lg font-semibold">Add a quick note</h3>
      <label className="block">What happened?<textarea value={text} onChange={event => setText(event.target.value)} required maxLength={4000} disabled={pending} placeholder="Conversation, next step, shelf conditions..." className="mt-2 min-h-40 w-full rounded-2xl border bg-white p-4 text-base" /></label>
      {message ? <p role="status" className="rounded-xl bg-stone-100 p-3">{message}</p> : null}
      <Button className="h-14 w-full text-base" disabled={pending}>{pending ? 'Saving...' : 'Save note'}</Button>
    </form>
  </div>
}

