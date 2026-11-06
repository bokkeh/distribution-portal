import { NextRequest, NextResponse } from 'next/server'
import { resolveRecipeTrackingToken } from '@/lib/marketing/recipe-email-tracking-token'
import { recordRecipeEmailEngagement } from '@/lib/marketing/recipe-email-engagement-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }

async function respond(request: NextRequest, record: boolean) {
  const payload = resolveRecipeTrackingToken(request.nextUrl.searchParams.get('token') ?? '')
  if (payload?.kind !== 'click' || !payload.url) return new NextResponse('This email link is not valid.', { status: 400, headers })
  if (record) {
    try { await recordRecipeEmailEngagement(payload) }
    catch (error) { console.error('Could not record recipe email click:', error) }
  }
  return new NextResponse(null, { status: 302, headers: { ...headers, Location: payload.url } })
}

export async function GET(request: NextRequest) { return respond(request, true) }
export async function HEAD(request: NextRequest) { return respond(request, false) }

