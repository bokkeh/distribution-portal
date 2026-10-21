import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyRecipeEmail } from '@/lib/marketing/weekly-recipe-email'

export const maxDuration = 300

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
    const result = await sendWeeklyRecipeEmail()
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Weekly recipe email failed' },
      { status: 500 },
    )
  }
}
