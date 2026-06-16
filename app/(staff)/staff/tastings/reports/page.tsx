import { db } from '@/db'
import { tastingReports, tasterInvoices, tastings, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { TastingReportsView } from '@/components/tastings/TastingReportsView'
import { getTastingAnalysesForTastings } from '@/actions/tasting-analysis'
import type { SerializedTastingAnalysis } from '@/components/tastings/TastingInsightsCard'

export default async function StaffTastingReportsPage() {
  await requireFeature('tastings', 'admin', 'staff')

  const rows = await db
    .select({
      tastingId: tastings.id,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      status: tastings.status,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
      tasterName: users.name,
      reportId: tastingReports.id,
      actualStartTime: tastingReports.actualStartTime,
      actualEndTime: tastingReports.actualEndTime,
      samplesServed: tastingReports.samplesServed,
      bottlesSold: tastingReports.bottlesSold,
      missedCustomers: tastingReports.missedCustomers,
      consumerInteractions: tastingReports.consumerInteractions,
      bottlePriceOnShelf: tastingReports.bottlePriceOnShelf,
      bottlesInStock: tastingReports.bottlesInStock,
      accountFeedback: tastingReports.accountFeedback,
      highlights: tastingReports.highlights,
      issues: tastingReports.issues,
      followUpNeeded: tastingReports.followUpNeeded,
      followUpNotes: tastingReports.followUpNotes,
      reportSubmittedAt: tastingReports.submittedAt,
      setupPhotoUrl: tastingReports.setupPhotoUrl,
      shelfPhotoUrls: tastingReports.shelfPhotoUrls,
      invoiceId: tasterInvoices.id,
      payeeName: tasterInvoices.payeeName,
      hourlyRate: tasterInvoices.hourlyRate,
      hoursWorked: tasterInvoices.hoursWorked,
      expenseAmount: tasterInvoices.expenseAmount,
      totalAmount: tasterInvoices.totalAmount,
      invoiceStatus: tasterInvoices.status,
      invoiceSubmittedAt: tasterInvoices.submittedAt,
    })
    .from(tastings)
    .leftJoin(users, eq(tastings.assignedUserId, users.id))
    .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
    .leftJoin(tasterInvoices, eq(tasterInvoices.tastingId, tastings.id))
    .orderBy(desc(tastings.scheduledAt))

  const tastingIds = rows.map(r => r.tastingId)
  let analysesMap: Record<string, SerializedTastingAnalysis> = {}
  try {
    const analyses = await getTastingAnalysesForTastings(tastingIds)
    analysesMap = Object.fromEntries(
      analyses.map(a => [a.tastingId, {
        ...a,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      } as SerializedTastingAnalysis])
    )
  } catch {
    // table may not exist yet — degrade gracefully
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/staff/tastings">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Taster Reports</h1>
            <p className="mt-1 text-muted-foreground">Event reports and invoices submitted by tasters.</p>
          </div>
        </div>
      </div>
      <TastingReportsView rows={rows} analysesMap={analysesMap} />
    </div>
  )
}
