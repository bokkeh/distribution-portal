import { NextRequest, NextResponse } from 'next/server'
import { generateSignedReadUrl } from '@/lib/gcs/client'

// No auth required — used to proxy GCS objects (e.g. avatars) that cannot be made
// publicly accessible because Public Access Prevention is enforced on the bucket.
// File paths are UUIDs so direct enumeration is not a practical concern.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return new NextResponse('Missing path', { status: 400 })

  try {
    const signedUrl = await generateSignedReadUrl(path)
    return NextResponse.redirect(signedUrl)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
