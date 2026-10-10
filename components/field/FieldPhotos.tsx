'use client'

import { useRef, useState } from 'react'
import { saveFieldPhoto } from '@/actions/field-data'
import { getEasternDateKey } from '@/lib/tastings/time'
import { Button } from '@/components/ui/button'

export function FieldPhotos({ accountId }: { accountId: string }) {
  const requestId = useRef<string | null>(null)
  const locked = useRef(false), input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null), [caption, setCaption] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState(''), [pending, setPending] = useState(false), [message, setMessage] = useState('')
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); if (!file || locked.current) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage('Use a JPG, PNG or WebP photo up to 10 MB. If your phone uses HEIC, choose a JPEG copy.'); return }
    locked.current = true; setPending(true); setMessage('')
    try {
      let mediaUrl = uploadedUrl
      if (!mediaUrl) {
        const upload = new FormData(); upload.set('file', file); upload.set('folder', 'account-media'); upload.set('filename', `field-${accountId}-${file.name}`)
        const response = await fetch('/api/upload', { method: 'POST', body: upload }); const payload = await response.json()
        if (!response.ok || !payload.publicUrl) throw new Error(payload.error ?? 'Photo upload failed. Retry.')
        mediaUrl = payload.publicUrl; setUploadedUrl(mediaUrl)
      }
      requestId.current ??= crypto.randomUUID()
      const result = await saveFieldPhoto({ requestId: requestId.current, accountId, mediaUrl, caption, date: getEasternDateKey(new Date()) })
      if (result.error) throw new Error(result.error)
      requestId.current = null; setMessage('Photo saved to this account.'); setFile(null); setCaption(''); setUploadedUrl(''); if (input.current) input.current.value = ''
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm photo save. Your selection is kept; retry.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <h2 className="text-xl font-semibold">Add a client photo</h2>
    <p className="text-sm text-muted-foreground">Shelf, display, or visit photos · JPG, PNG, WebP up to 10 MB.</p>
    <label className="block rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-5 font-semibold">Take or choose photo<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required disabled={pending} className="mt-3 block w-full text-base" onChange={event => { setFile(event.target.files?.[0] ?? null); setUploadedUrl(''); requestId.current = null; setMessage('') }} /></label>
    {file ? <p className="break-all text-sm">Selected: {file.name}</p> : null}
    <label className="block">Caption (optional)<textarea value={caption} onChange={event => setCaption(event.target.value)} disabled={pending} maxLength={2000} className="mt-2 min-h-28 w-full rounded-xl border bg-white p-4 text-base" /></label>
    {message ? <p role="status" className="rounded-xl bg-stone-100 p-3">{message}</p> : null}
    <Button disabled={!file || pending} className="h-14 w-full text-base">{pending ? 'Uploading & saving…' : 'Save photo to account'}</Button>
  </form>
}
