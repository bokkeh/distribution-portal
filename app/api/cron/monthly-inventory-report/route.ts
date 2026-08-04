import { NextRequest, NextResponse } from 'next/server'
import { generateAndSendMonthlyInventoryReport } from '@/lib/inventory/monthly-report'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await generateAndSendMonthlyInventoryReport()
    return NextResponse.json({ ok: true, reportId: result.report.id, status: result.report.status, alreadySent: result.alreadySent })
  } catch (error) {
    console.error('Monthly inventory report failed:', error)
    return NextResponse.json({ error: 'Monthly inventory report failed' }, { status: 500 })
  }
}
