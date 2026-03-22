import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { generateSignedReadUrl } from '@/lib/gcs/client'

const GCS_BASE = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) return new NextResponse('Missing url param', { status: 400 })

  // Extract the GCS object path from the full public URL
  const filePath = rawUrl.startsWith(GCS_BASE)
    ? rawUrl.slice(GCS_BASE.length)
    : rawUrl

  try {
    const signedUrl = await generateSignedReadUrl(decodeURIComponent(filePath))
    return NextResponse.redirect(signedUrl)
  } catch {
    return new NextResponse('Failed to generate signed URL', { status: 500 })
  }
}
