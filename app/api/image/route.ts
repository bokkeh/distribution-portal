import { NextRequest, NextResponse } from 'next/server'
import { generateSignedReadUrl } from '@/lib/gcs/client'

const ALLOWED_PREFIXES = ['uploads/', 'avatars/', 'documents/', 'tastings/', 'products/', 'deliveries/', 'account-media/']

// No auth required — used to proxy GCS objects (e.g. avatars) that cannot be made
// publicly accessible because Public Access Prevention is enforced on the bucket.
// Paths are restricted to known folders; traversal attempts are rejected.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return new NextResponse('Missing path', { status: 400 })

  const safe = ALLOWED_PREFIXES.some(p => path.startsWith(p)) && !path.includes('..')
  if (!safe) return new NextResponse('Forbidden', { status: 403 })

  try {
    const signedUrl = await generateSignedReadUrl(path)
    return NextResponse.redirect(signedUrl)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
