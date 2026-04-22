import { NextRequest, NextResponse } from 'next/server'
import { sendIndustryNewsDigests } from '@/lib/industry-news'

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
    const daily = await sendIndustryNewsDigests('daily_digest')
    const isMonday = new Date().getUTCDay() === 1
    const weekly = isMonday
      ? await sendIndustryNewsDigests('weekly_digest')
      : { sent: 0, failed: 0, total: 0 }

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      daily,
      weekly,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Industry news digest failed' },
      { status: 500 },
    )
  }
}
