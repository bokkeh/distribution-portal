import { NextRequest, NextResponse } from 'next/server'
import { syncIndustryNews } from '@/lib/industry-news'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await syncIndustryNews(true)
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Industry news sync failed' },
      { status: 500 }
    )
  }
}
