import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { generateSignedReadUrl } from '@/lib/gcs/client'

const GCS_BASE = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`
const ALLOWED_PREFIXES = ['uploads/', 'avatars/', 'documents/', 'tastings/', 'events/', 'products/', 'deliveries/', 'sales-routes/', 'account-media/']

function extractObjectPath(rawUrl: string) {
  const path = rawUrl.startsWith(GCS_BASE)
    ? rawUrl.slice(GCS_BASE.length)
    : rawUrl

  return decodeURIComponent(path).trim().replace(/^\/+/, '')
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) return new NextResponse('Missing url param', { status: 400 })

  // Extract the GCS object path from the full public URL
  const filePath = extractObjectPath(rawUrl)
  const isAllowedPath = ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix)) && !filePath.includes('..')
  if (!isAllowedPath) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const signedUrl = await generateSignedReadUrl(filePath)
    return NextResponse.redirect(signedUrl)
  } catch {
    return new NextResponse('Failed to generate signed URL', { status: 500 })
  }
}
