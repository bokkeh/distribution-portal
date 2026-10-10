'use client'

import { useRef, useState } from 'react'
import { saveFieldPhoto } from '@/actions/field-data'
import { getEasternDateKey } from '@/lib/tastings/time'
import { Button } from '@/components/ui/button'

type Photo = { id: string; file: File; mediaUrl?: string; caption?: string; date?: string; saved?: boolean; error?: string }

export function FieldPhotos({ accountId }: { accountId: string }) {
  const locked = useRef(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [caption, setCaption] = useState(''), [pending, setPending] = useState(false), [message, setMessage] = useState('')
  const unsaved = photos.filter(photo => !photo.saved)
  function addFiles(files: FileList | null) {
    if (locked.current || !files) return
    const selected = Array.from(files)
    const invalid = selected.filter(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
    setMessage(invalid.length ? `${invalid.map(file => file.name).join(', ')}: use JPG, PNG or WebP up to 10 MB. For HEIC, choose a JPEG copy.` : '')
    setPhotos(previous => {
      const next = [...previous]
      for (const file of selected.filter(file => !invalid.includes(file))) {
        if (!next.some(photo => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified && photo.file.type === file.type)) next.push({ id: crypto.randomUUID(), file })
      }
      return next
    })
  }
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); if (!unsaved.length || locked.current) return
    locked.current = true; setPending(true); setMessage('')
    const queue = photos.map(photo => photo.saved ? photo : { ...photo, caption: photo.caption ?? caption, date: photo.date ?? getEasternDateKey(new Date()), error: undefined })
    const update = () => setPhotos(queue.map(photo => ({ ...photo })))
    update()
    let saved = 0
    try {
      for (const photo of queue.filter(item => !item.saved)) {
        try {
          if (!photo.mediaUrl) {
            const upload = new FormData(); upload.set('file', photo.file); upload.set('folder', 'account-media'); upload.set('filename', `field-${accountId}-${photo.id}-${photo.file.name}`)
            const response = await fetch('/api/upload', { method: 'POST', body: upload }); const payload = await response.json()
            if (!response.ok || typeof payload.publicUrl !== 'string' || !payload.publicUrl) throw new Error(payload.error ?? 'Photo upload failed. Retry.')
            photo.mediaUrl = payload.publicUrl
            update()
          }
          const result = await saveFieldPhoto({ requestId: photo.id, accountId, mediaUrl: photo.mediaUrl!, caption: photo.caption!, date: photo.date! })
          if (result.error) throw new Error(result.error)
          photo.saved = true; saved++
        } catch (error) { photo.error = error instanceof Error ? error.message : 'Could not confirm save. Retry this photo.' }
        update()
      }
      const failed = queue.filter(photo => !photo.saved).length
      setMessage(failed ? `${saved} photos confirmed saved. ${failed} could not be confirmed; retry unsaved photos below.` : `${saved} ${saved === 1 ? 'photo' : 'photos'} saved to this account.`)
      if (!failed) setCaption('')
    } finally { locked.current = false; setPending(false) }
  }}>
    <h2 className="text-xl font-semibold">Add client photos</h2>
    <p className="text-sm text-muted-foreground">Shelf, display, or visit photos · JPG, PNG, WebP up to 10 MB each.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block min-w-0 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-5 font-semibold">Choose from gallery<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending} className="mt-3 block w-full min-w-0 text-base" onChange={event => { addFiles(event.target.files); event.target.value = '' }} /></label>
      <label className="block min-w-0 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-5 font-semibold">Take a photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={pending} className="mt-3 block w-full min-w-0 text-base" onChange={event => { addFiles(event.target.files); event.target.value = '' }} /></label>
    </div>
    {photos.length ? <ul className="space-y-2" aria-label="Selected photos">{photos.map(photo => <li key={photo.id} className="rounded-xl border bg-white p-3">
      <p className="break-all font-medium">{photo.file.name}</p>
      <p className="text-sm">{photo.saved ? 'Saved' : photo.error ? 'Not confirmed — retry' : photo.mediaUrl ? 'Uploaded; awaiting save' : 'Ready to upload'}</p>
      {photo.error ? <p role="alert" className="break-words text-sm text-red-700">{photo.error}</p> : null}
      {!photo.saved && !photo.mediaUrl ? <Button type="button" variant="outline" disabled={pending} aria-label={`Remove ${photo.file.name}`} onClick={() => setPhotos(previous => previous.filter(item => item.id !== photo.id))}>Remove</Button> : null}
    </li>)}</ul> : null}
    <label className="block">Caption for new photos (optional)<textarea value={caption} onChange={event => setCaption(event.target.value)} disabled={pending} maxLength={2000} className="mt-2 min-h-28 w-full rounded-xl border bg-white p-4 text-base" /></label>
    {message ? <p role="status" className="rounded-xl bg-stone-100 p-3">{message}</p> : null}
    <Button disabled={!unsaved.length || pending} className="h-14 w-full text-base">{pending ? 'Uploading & saving…' : unsaved.some(photo => photo.error) ? 'Retry unsaved photos' : `Save ${unsaved.length} ${unsaved.length === 1 ? 'photo' : 'photos'} to account`}</Button>
    {photos.length && !unsaved.length ? <Button type="button" variant="outline" className="h-14 w-full text-base" onClick={() => { setPhotos([]); setMessage('') }}>Add more photos</Button> : null}
  </form>
}
