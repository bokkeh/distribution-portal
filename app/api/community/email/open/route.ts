import { NextRequest, NextResponse } from 'next/server'
import { resolveRecipeTrackingToken } from '@/lib/marketing/recipe-email-tracking-token'
import { recordRecipeEmailEngagement } from '@/lib/marketing/recipe-email-engagement-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Content-Type': 'image/gif', 'Cache-Control': 'private, no-store, no-cache, max-age=0', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }
const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(request: NextRequest) {
  const payload = resolveRecipeTrackingToken(request.nextUrl.searchParams.get('token') ?? '')
  if (payload?.kind === 'open') {
    try { await recordRecipeEmailEngagement(payload) }
    catch (error) { console.error('Could not record recipe email open:', error) }
  }
  return new NextResponse(pixel, { headers })
}

export async function HEAD() { return new NextResponse(null, { headers }) }

