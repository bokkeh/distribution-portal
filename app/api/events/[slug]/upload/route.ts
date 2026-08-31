import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/db'
import { communityContacts, eventMedia, events } from '@/db/schema'
import { isEventUploadRateLimited, rateLimitResponse } from '@/lib/auth/rate-limit'
import { generateSignedUploadUrl } from '@/lib/gcs/client'
import { logActivityEvent } from '@/lib/activity/log'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'])

function extension(filename: string, contentType: string) {
  const value = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (value && value.length <= 8) return value
  if (contentType.startsWith('video/')) return 'mp4'
  return 'jpg'
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
    if (await isEventUploadRateLimited(`${slug}:${ip}`)) return rateLimitResponse()

    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1)
    if (!event || event.visibility === 'draft' || event.status === 'cancelled' || event.attendeeUploadPolicy === 'disabled') {
      return NextResponse.json({ error: 'Photo uploads are not open for this event.' }, { status: 403 })
    }

    const payload = await request.json()
    if (payload.action === 'prepare') {
      const filename = String(payload.filename ?? '')
      const contentType = String(payload.contentType ?? '')
      const size = Number(payload.size ?? 0)
      if (!filename || !ALLOWED_TYPES.has(contentType)) return NextResponse.json({ error: 'Upload a JPG, PNG, WEBP, HEIC, MP4, MOV, or WEBM file.' }, { status: 400 })
      if (!Number.isFinite(size) || size <= 0 || size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Files must be 50MB or smaller.' }, { status: 400 })
      const objectName = `${event.id}/attendee/${uuidv4()}.${extension(filename, contentType)}`
      const signed = await generateSignedUploadUrl(objectName, contentType, 'events')
      return NextResponse.json({ uploadUrl: signed.uploadUrl, storagePath: `events/${objectName}` })
    }

    if (payload.action === 'complete') {
      const storagePath = String(payload.storagePath ?? '')
      const fileName = String(payload.fileName ?? '').slice(0, 255)
      const contentType = String(payload.contentType ?? '')
      const uploaderName = String(payload.uploaderName ?? '').trim().slice(0, 160)
      const uploaderEmail = String(payload.uploaderEmail ?? '').trim().toLowerCase().slice(0, 254)
      const expectedPrefix = `events/${event.id}/attendee/`
      if (!storagePath.startsWith(expectedPrefix) || storagePath.includes('..') || !fileName || !ALLOWED_TYPES.has(contentType)) {
        return NextResponse.json({ error: 'Invalid upload completion.' }, { status: 400 })
      }
      const [contact] = uploaderEmail
        ? await db.select({ id: communityContacts.id }).from(communityContacts).where(sql`lower(${communityContacts.email}) = ${uploaderEmail}`).limit(1)
        : []
      const approvalStatus = event.attendeeUploadPolicy === 'immediate' ? 'approved' : event.attendeeUploadPolicy === 'private' ? 'private' : 'pending'
      const [media] = await db.insert(eventMedia).values({
        eventId: event.id,
        storagePath,
        fileName,
        contentType,
        mediaType: contentType.startsWith('video/') ? 'video' : 'image',
        placement: approvalStatus === 'private' ? 'internal' : 'gallery',
        uploadSource: 'attendee',
        approvalStatus,
        uploadedByContactId: contact?.id ?? null,
        uploaderName: uploaderName || null,
        uploaderEmail: uploaderEmail || null,
      }).returning({ id: eventMedia.id })
      await logActivityEvent({ entityType: 'event', entityId: event.id, kind: 'event_attendee_media_uploaded', title: 'Attendee media uploaded', body: fileName, metadata: { mediaId: media.id, approvalStatus } })
      if (contact) await logActivityEvent({ entityType: 'community_contact', entityId: contact.id, kind: 'event_media_uploaded', title: `Uploaded media to ${event.title}`, metadata: { eventId: event.id, mediaId: media.id } })
      return NextResponse.json({ success: true, approvalStatus })
    }

    return NextResponse.json({ error: 'Unknown upload action.' }, { status: 400 })
  } catch (error) {
    console.error('Public event upload failed:', error)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
