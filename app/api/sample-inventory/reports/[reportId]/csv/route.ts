import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { monthlyInventoryReports } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  await requireAdminOrStaff()
  const { reportId } = await params
  const [report] = await db.select().from(monthlyInventoryReports).where(eq(monthlyInventoryReports.id, reportId)).limit(1)
  if (!report?.csvContent) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  return new NextResponse(report.csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sample-inventory-${report.reportMonth}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
