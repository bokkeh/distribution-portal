'use client'

import { DragEvent, useState } from 'react'
import { ImagePlus, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { saveEventMedia } from '@/actions/events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function mediaType(contentType: string) {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType === 'application/pdf') return 'pdf'
  return 'document'
}

export function EventMediaUploader({ eventId }: { eventId: string }) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState<{ storagePath: string; fileName: string; contentType: string; mediaType: string } | null>(null)

  async function upload(file: File) {
    if (file.size > 50 * 1024 * 1024) return toast.error('Files must be 50MB or smaller.')
    setUploading(true)
    try {
      const prepare = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: `event-${eventId}-${file.name}`, contentType: file.type || 'application/octet-stream', folder: 'events' }) })
      const payload = await prepare.json()
      if (!prepare.ok) throw new Error(payload.error || 'Could not prepare upload')
      const put = await fetch(payload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) throw new Error('File upload failed')
      setUploaded({ storagePath: payload.filePath, fileName: file.name, contentType: file.type || 'application/octet-stream', mediaType: mediaType(file.type) })
      toast.success('Upload complete. Choose how to use the asset.')
    } catch (error) { toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined }) } finally { setUploading(false) }
  }

  function drop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void upload(file) }

  return (
    <form action={saveEventMedia} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      {uploaded ? <><input type="hidden" name="storagePath" value={uploaded.storagePath} /><input type="hidden" name="fileName" value={uploaded.fileName} /><input type="hidden" name="contentType" value={uploaded.contentType} /><input type="hidden" name="mediaType" value={uploaded.mediaType} /></> : null}
      <label onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center ${dragging ? 'border-[#ff5a00] bg-orange-50' : 'border-slate-300 bg-slate-50'}`}>
        {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7 text-slate-500" />}<span className="mt-2 text-sm font-semibold">{uploaded ? uploaded.fileName : 'Drag and drop or choose a file'}</span><span className="text-xs text-slate-500">Images, short videos, PDFs, flyers, menus, sponsor assets · 50MB max</span>
        <input type="file" className="hidden" accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf,.doc,.docx,.ppt,.pptx" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`event-placement-${eventId}`}>Use as</Label><select id={`event-placement-${eventId}`} name="placement" defaultValue="gallery" className="w-full"><option value="hero">Event hero</option><option value="gallery">Event gallery</option><option value="promotional">Promotional image</option><option value="attachment">Downloadable attachment</option><option value="internal">Hidden/internal</option></select></div><div className="space-y-2"><Label htmlFor={`event-caption-${eventId}`}>Caption</Label><Input id={`event-caption-${eventId}`} name="caption" /></div></div>
      <Button type="submit" disabled={!uploaded || uploading}><Upload className="h-4 w-4" />Save to media library</Button>
    </form>
  )
}
