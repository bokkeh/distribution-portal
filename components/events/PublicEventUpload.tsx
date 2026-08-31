'use client'

import { DragEvent, useState } from 'react'
import { Camera, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UploadState = { name: string; status: 'uploading' | 'done' | 'error'; message?: string }

export function PublicEventUpload({ slug, policy }: { slug: string; policy: string }) {
  const [dragging, setDragging] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [uploaderEmail, setUploaderEmail] = useState('')
  const [uploads, setUploads] = useState<UploadState[]>([])

  async function uploadFiles(files: File[]) {
    for (const file of files.slice(0, 12)) {
      setUploads((current) => [...current, { name: file.name, status: 'uploading' }])
      try {
        const prepare = await fetch(`/api/events/${encodeURIComponent(slug)}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare', filename: file.name, contentType: file.type, size: file.size }) })
        const prepared = await prepare.json()
        if (!prepare.ok) throw new Error(prepared.error || 'Could not prepare upload')
        const uploaded = await fetch(prepared.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
        if (!uploaded.ok) throw new Error('Upload transfer failed')
        const complete = await fetch(`/api/events/${encodeURIComponent(slug)}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete', storagePath: prepared.storagePath, fileName: file.name, contentType: file.type, uploaderName, uploaderEmail }) })
        const completed = await complete.json()
        if (!complete.ok) throw new Error(completed.error || 'Could not save upload')
        setUploads((current) => current.map((item) => item.name === file.name && item.status === 'uploading' ? { name: file.name, status: 'done', message: completed.approvalStatus === 'pending' ? 'Submitted for approval' : completed.approvalStatus === 'private' ? 'Saved privately for the organizer' : 'Added to the event gallery' } : item))
      } catch (error) {
        setUploads((current) => current.map((item) => item.name === file.name && item.status === 'uploading' ? { name: file.name, status: 'error', message: error instanceof Error ? error.message : 'Upload failed' } : item))
      }
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setDragging(false); void uploadFiles(Array.from(event.dataTransfer.files ?? [])) }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="upload-name">Your name <span className="text-slate-400">(optional)</span></Label><Input id="upload-name" value={uploaderName} onChange={(event) => setUploaderName(event.target.value)} autoComplete="name" /></div><div className="space-y-2"><Label htmlFor="upload-email">Email <span className="text-slate-400">(optional)</span></Label><Input id="upload-email" type="email" value={uploaderEmail} onChange={(event) => setUploaderEmail(event.target.value)} autoComplete="email" /></div></div>
      <label onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center ${dragging ? 'border-[#ff5a00] bg-orange-50' : 'border-slate-300 bg-white'}`}><Camera className="h-10 w-10 text-[#ff5a00]" /><span className="font-display mt-3 text-xl font-bold uppercase">Share your photos from tonight</span><span className="mt-1 max-w-md text-sm text-slate-500">Choose from your camera roll or drag in photos and short videos. Up to 12 files, 50MB each.</span><Button type="button" className="pointer-events-none mt-5 bg-[#ff5a00]">Choose photos or videos</Button><input type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} /></label>
      {policy === 'approval' ? <p className="text-center text-xs text-slate-500">Uploads are reviewed by the event organizer before appearing publicly.</p> : policy === 'private' ? <p className="text-center text-xs text-slate-500">Uploads remain private and are only visible to the event organizer.</p> : null}
      {uploads.length ? <div className="space-y-2">{uploads.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">{item.status === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : item.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-full bg-red-500" />}<div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p>{item.message ? <p className={`text-xs ${item.status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{item.message}</p> : null}</div></div>)}</div> : null}
    </div>
  )
}
