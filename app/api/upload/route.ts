import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { generateSignedUploadUrl, uploadBuffer } from '@/lib/gcs/client'
import { v4 as uuidv4 } from 'uuid'
import { isUploadRateLimited, rateLimitResponse } from '@/lib/auth/rate-limit'

function getExtension(filename: string, contentType: string) {
  const existing = filename.split('.').pop()
  if (existing && existing !== filename) return existing
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (await isUploadRateLimited(session.user.id)) return rateLimitResponse()

    const contentType = req.headers.get('content-type') ?? ''

    // JSON request → return a signed upload URL for direct browser-to-GCS upload
    if (contentType.includes('application/json')) {
      const { filename, contentType: fileContentType, folder } = await req.json()
      const ext = getExtension(filename, fileContentType)
      const uniqueFilename = `${uuidv4()}.${ext}`
      const result = await generateSignedUploadUrl(uniqueFilename, fileContentType, folder ?? 'uploads')
      return NextResponse.json({ uploadUrl: result.uploadUrl, publicUrl: result.publicUrl, filename: uniqueFilename })
    }

    // Multipart form data → server-side buffer upload
    const formData = await req.formData()
    const file = formData.get('file')
    const folder = (formData.get('folder') as string) || 'uploads'
    const filename = (formData.get('filename') as string) || 'upload.jpg'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const ext = getExtension(filename, file.type)
    const uniqueFilename = `${uuidv4()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadBuffer(uniqueFilename, file.type || 'application/octet-stream', buffer, folder)

    return NextResponse.json({
      ...uploaded,
      publicUrl: `/api/image?path=${encodeURIComponent(uploaded.filePath)}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    console.error('[/api/upload]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
