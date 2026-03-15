import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import { tasterInvoices, tastingReports, tastings, users } from '@/db/schema'
import { TastingSubmissionDetail } from '@/components/tastings/TastingSubmissionDetail'
import { Button } from '@/components/ui/button'
import { requireFeature } from '@/lib/auth/session'
import { getTastingById } from '@/lib/tastings/read'

function isMissingSubmissionTables(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist'))
  )
}

export default async function TasterTastingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tastingId: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const { tastingId } = await params
  const query = await searchParams

  const tasting = await getTastingById(tastingId)

  if (!tasting) notFound()

  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin') && tasting.assignedUserId !== session.user.id) notFound()

  try {
    const [report, invoice, assignedUser] = await Promise.all([
      db.select().from(tastingReports).where(eq(tastingReports.tastingId, tastingId)).then(rows => rows[0] ?? null),
      db.select().from(tasterInvoices).where(eq(tasterInvoices.tastingId, tastingId)).then(rows => rows[0] ?? null),
      db.select({ phone: users.phone }).from(users).where(eq(users.id, tasting.assignedUserId)).then(rows => rows[0] ?? null),
    ])

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/taster/tastings"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tasting Report & Invoice</h1>
            <p className="text-muted-foreground mt-1">Complete your event report and submit your payment request.</p>
          </div>
        </div>
        <TastingSubmissionDetail
          tasting={tasting}
          report={report ? {
            actualStartTime: report.actualStartTime,
            actualEndTime: report.actualEndTime,
            samplesServed: report.samplesServed,
            bottlesSold: report.bottlesSold,
            casesSold: report.casesSold,
            consumerInteractions: report.consumerInteractions,
            accountFeedback: report.accountFeedback,
            highlights: report.highlights,
            issues: report.issues,
            followUpNeeded: report.followUpNeeded,
            followUpNotes: report.followUpNotes,
            submittedAt: report.submittedAt,
          } : null}
          invoice={invoice ? {
            payeeName: invoice.payeeName,
            payeeEmail: invoice.payeeEmail,
            payeePhone: invoice.payeePhone,
            hourlyRate: invoice.hourlyRate,
            hoursWorked: invoice.hoursWorked,
            mileage: invoice.mileage,
            expenseAmount: invoice.expenseAmount,
            totalAmount: invoice.totalAmount,
            notes: invoice.notes,
            status: invoice.status,
            submittedAt: invoice.submittedAt,
          } : null}
          user={{ name: session.user.name, email: session.user.email, phone: assignedUser?.phone ?? null }}
          success={query.success}
          error={query.error}
        />
      </div>
    )
  } catch (error) {
    if (!isMissingSubmissionTables(error)) throw error

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/taster/tastings"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tasting Report & Invoice</h1>
            <p className="text-muted-foreground mt-1">Complete your event report and submit your payment request.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The taster report and invoice tables are not in this database yet. Run `npm run db:migrate` before using these forms in production.
        </div>
      </div>
    )
  }
}
