import React from 'react'
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { monthlyInventoryReports } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'

const styles = StyleSheet.create({ page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica' }, title: { fontSize: 20, fontWeight: 700, marginBottom: 8 }, subtitle: { color: '#475569', marginBottom: 20 }, box: { border: '1 solid #cbd5e1', borderRadius: 6, padding: 12, marginBottom: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, label: { color: '#475569' }, value: { fontWeight: 700 } })

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  await requireAdminOrStaff()
  const { reportId } = await params
  const [report] = await db.select().from(monthlyInventoryReports).where(eq(monthlyInventoryReports.id, reportId)).limit(1)
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  const summary = report.summary as { movementCount?: number; totalEstimatedCost?: number; lowStockCount?: number; failedExportCount?: number }
  const line = (label: string, value: string | number) => React.createElement(View, { style: styles.row, key: label }, React.createElement(Text, { style: styles.label }, label), React.createElement(Text, { style: styles.value }, String(value)))
  const document = React.createElement(Document, null,
    React.createElement(Page, { size: 'LETTER', style: styles.page },
      React.createElement(Text, { style: styles.title }, 'Monthly Sample Inventory Report'),
      React.createElement(Text, { style: styles.subtitle }, report.reportMonth),
      React.createElement(View, { style: styles.box },
        line('Inventory movements', summary.movementCount ?? 0),
        line('Estimated sample cost', `$${Number(summary.totalEstimatedCost ?? 0).toFixed(2)}`),
        line('Open low-stock alerts', summary.lowStockCount ?? 0),
        line('QuickBooks items needing attention', summary.failedExportCount ?? 0),
        line('Delivery status', report.status.replaceAll('_', ' ')),
      ),
      React.createElement(Text, null, 'Download the companion CSV from the Distribution Portal for movement-level detail.'),
    ),
  )
  const buffer = await renderToBuffer(document)
  return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="sample-inventory-${report.reportMonth}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
