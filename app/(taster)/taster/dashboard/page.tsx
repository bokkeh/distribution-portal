import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { CalendarDays, CheckCircle2, Clock3, DollarSign, FileText, Mail, Phone, Sparkles, Wallet } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getTastingsForView } from '@/actions/tastings'
import { db } from '@/db'
import { tasterInvoices, tastingReportPhotoDrafts, tastingReports, tastings, users } from '@/db/schema'
import { getUserPreferences } from '@/lib/preferences/read'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TastingReportFormCard } from '@/components/tastings/TastingReportFormCard'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { IndustryNewsWidget } from '@/components/news/IndustryNewsWidget'

function isMissingTastingsTable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    (message.includes('tastings') && message.includes('does not exist')) ||
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('tasting_report_photo_drafts') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist'))
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function TasterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const params = await searchParams

  try {
    const [tastingRows, preferences, user] = await Promise.all([
      getTastingsForView({ assignedUserId: session.user.id }),
      getUserPreferences(session.user.id),
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          tasterHourlyRate: users.tasterHourlyRate,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .then(rows => rows[0] ?? null),
    ])

    const reportsNeeded = tastingRows.filter(tasting => tasting.status === 'completed' && !tasting.reportSubmittedAt)
    const invoicesNeeded = tastingRows.filter(tasting => (Boolean(tasting.reportSubmittedAt) || tasting.status === 'completed') && !tasting.invoiceSubmittedAt)
    const upcoming = tastingRows.filter(tasting => new Date(tasting.scheduledAt) >= new Date())
    const confirmedUpcoming = upcoming.filter(tasting => tasting.status === 'confirmed')
    const nextTasting = upcoming[0] ?? null
    const featuredTasting = reportsNeeded[0] ?? nextTasting ?? null
    const submittedReports = tastingRows.filter(tasting => tasting.reportSubmittedAt)

    const [report, reportPhotoDraft] = featuredTasting
      ? await Promise.all([
          db.select().from(tastingReports).where(eq(tastingReports.tastingId, featuredTasting.id)).then(rows => rows[0] ?? null),
          db.select().from(tastingReportPhotoDrafts).where(eq(tastingReportPhotoDrafts.tastingId, featuredTasting.id)).then(rows => rows[0] ?? null),
        ])
      : [null, null]

    const invoiceRows = await db
      .select({
        totalAmount: tasterInvoices.totalAmount,
        status: tasterInvoices.status,
      })
      .from(tasterInvoices)
      .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
      .where(eq(tastings.assignedUserId, session.user.id))

    const payoutSubmitted = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.totalAmount ?? '0'), 0)
    const payoutPaid = invoiceRows
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.totalAmount ?? '0'), 0)

    const readiness = [
      {
        label: 'Onboarding complete',
        hint: preferences.tasterOnboardingCompletedAt ? 'You can access the full portal workflow.' : 'Finish onboarding before your next event.',
        ready: Boolean(preferences.tasterOnboardingCompletedAt),
      },
      {
        label: 'Mobile contact on file',
        hint: user?.phone ? user.phone : 'Add a phone number so assignments and reminders can reach you.',
        ready: Boolean(user?.phone),
      },
      {
        label: 'Email notifications',
        hint: preferences.emailNotificationsEnabled ? 'Assignment updates will hit your inbox.' : 'Turn email notifications on in your profile.',
        ready: preferences.emailNotificationsEnabled,
      },
      {
        label: 'SMS notifications',
        hint: preferences.smsNotificationsEnabled ? 'Event reminders and prompts are enabled.' : 'Turn on SMS if you want event-day reminders.',
        ready: preferences.smsNotificationsEnabled,
      },
    ]

    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-rose-50/30 to-amber-50/70">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Taster HQ</Badge>
                {nextTasting ? <Badge variant="outline" className="border-slate-300 text-slate-700">Next event queued</Badge> : null}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Stay ready for assignments, close out reports fast, and keep your payout workflow clean after each tasting.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Upcoming</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{upcoming.length}</p>
                  <p className="mt-1 text-xs text-slate-500">{confirmedUpcoming.length} confirmed</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Reports due</p>
                  <p className="mt-2 text-3xl font-bold text-amber-600">{reportsNeeded.length}</p>
                  <p className="mt-1 text-xs text-slate-500">{submittedReports.length} reports submitted</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Invoices due</p>
                  <p className="mt-2 text-3xl font-bold text-orange-600">{invoicesNeeded.length}</p>
                  <p className="mt-1 text-xs text-slate-500">{invoiceRows.length} invoice{invoiceRows.length === 1 ? '' : 's'} submitted</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Submitted payout</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(payoutSubmitted)}</p>
                  <p className="mt-1 text-xs text-slate-500">Paid: {formatCurrency(payoutPaid)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/taster/tastings">
                  <Button>Open Tastings</Button>
                </Link>
                <Link href="/taster/payouts">
                  <Button variant="outline">Review Payouts</Button>
                </Link>
                <Link href="/taster/availability">
                  <Button variant="outline">Update Availability</Button>
                </Link>
              </div>
            </div>

            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What Needs Attention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={reportsNeeded[0] ? `/taster/tastings/${reportsNeeded[0].id}#report` : '/taster/tastings/reports'} className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">Report backlog</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {reportsNeeded.length > 0 ? `${reportsNeeded.length} completed tasting${reportsNeeded.length === 1 ? '' : 's'} still need reports.` : 'All completed tastings have reports submitted.'}
                      </p>
                    </div>
                    <Badge variant={reportsNeeded.length > 0 ? 'warning' : 'success'}>{reportsNeeded.length}</Badge>
                  </div>
                </Link>
                <Link href={invoicesNeeded[0] ? `/taster/tastings/${invoicesNeeded[0].id}#invoice` : '/taster/payouts'} className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">Invoice follow-up</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {invoicesNeeded.length > 0 ? `${invoicesNeeded.length} tasting${invoicesNeeded.length === 1 ? '' : 's'} still need payout requests.` : 'All completed tastings have matching invoices.'}
                      </p>
                    </div>
                    <Badge variant={invoicesNeeded.length > 0 ? 'warning' : 'success'}>{invoicesNeeded.length}</Badge>
                  </div>
                </Link>
                <Link href={nextTasting ? `/taster/tastings/${nextTasting.id}` : '/taster/tastings'} className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">Next assignment</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {nextTasting ? `${nextTasting.eventName} on ${formatEasternDateTime(new Date(nextTasting.scheduledAt))}` : 'No upcoming tastings assigned yet.'}
                      </p>
                    </div>
                    <Badge variant={nextTasting ? 'info' : 'secondary'}>{nextTasting ? 'Queued' : 'Open'}</Badge>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {featuredTasting ? (
              <div className="space-y-4">
                <Card className="overflow-hidden border-slate-200">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-[1.1fr_0.9fr]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {reportsNeeded.length ? 'Priority follow-up' : 'Next assignment'}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">{featuredTasting.eventName}</h2>
                      <p className="mt-2 text-sm text-slate-600">{formatEasternDateTime(new Date(featuredTasting.scheduledAt))}</p>
                      <p className="mt-3 text-sm text-slate-500">
                        {[featuredTasting.storeAddress, featuredTasting.storeCity, featuredTasting.storeState, featuredTasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant={featuredTasting.status === 'completed' ? 'success' : featuredTasting.status === 'confirmed' ? 'info' : 'secondary'} className="capitalize">
                          {featuredTasting.status}
                        </Badge>
                        {featuredTasting.reportSubmittedAt ? <Badge variant="success">Report submitted</Badge> : null}
                        {featuredTasting.invoiceSubmittedAt ? <Badge variant="info">Invoice {featuredTasting.invoiceStatus ?? 'submitted'}</Badge> : null}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-900">Event readiness</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {featuredTasting.status === 'completed'
                            ? 'This tasting is complete. Finish the report and invoice if anything is still open.'
                            : 'Review the store details, keep your phone on, and update the report from the field after the event.'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-900">Comp rate</p>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(Number(user?.tasterHourlyRate ?? '25'))}/hr</p>
                        <p className="mt-1 text-xs text-slate-500">Used for invoice calculations when you submit hours.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <TastingReportFormCard
                  tasting={{
                    id: featuredTasting.id,
                    eventName: featuredTasting.eventName,
                    scheduledAt: new Date(featuredTasting.scheduledAt),
                  }}
                  report={report ? {
                    actualStartTime: report.actualStartTime,
                    actualEndTime: report.actualEndTime,
                    samplesServed: report.samplesServed,
                    bottlesSold: report.bottlesSold,
                    missedCustomers: report.missedCustomers,
                    consumerInteractions: report.consumerInteractions,
                    bottlePriceOnShelf: report.bottlePriceOnShelf,
                    bottlesInStockBefore: report.bottlesInStockBefore,
                    bottlesInStockAfter: report.bottlesInStockAfter,
                    accountFeedback: report.accountFeedback,
                    highlights: report.highlights,
                    issues: report.issues,
                    followUpNeeded: report.followUpNeeded,
                    followUpNotes: report.followUpNotes,
                    setupPhotoUrl: report.setupPhotoUrl ?? null,
                    shelfPhotoUrls: (report.shelfPhotoUrls as string[] | null) ?? null,
                    submittedAt: report.submittedAt,
                  } : null}
                  reportPhotoDraft={reportPhotoDraft ? {
                    setupPhotoUrl: reportPhotoDraft.setupPhotoUrl,
                    shelfPhotoUrls: reportPhotoDraft.shelfPhotoUrls,
                  } : null}
                  success={params.success}
                  error={params.error}
                  compact
                />
                <Link href={`/taster/tastings/${featuredTasting.id}`}>
                  <Button variant="outline">Open Full Tasting Details</Button>
                </Link>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-sm text-slate-500">
                  No tastings are assigned right now.
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  Readiness Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {readiness.map(item => (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <div className={`mt-0.5 rounded-full p-1 ${item.ready ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {item.ready ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
                    </div>
                  </div>
                ))}
                <Link href="/taster/profile">
                  <Button variant="outline" className="w-full">Open Profile Settings</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-slate-400" />
                  Payout Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Submitted total</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(payoutSubmitted)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Paid out</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(payoutPaid)}</p>
                </div>
                <Link href="/taster/payouts">
                  <Button variant="outline" className="w-full">Open Payout History</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Link href="/taster/tastings" className="rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <p className="font-medium text-slate-900">All Tastings</p>
                  <p className="mt-1 text-xs text-slate-500">Assignment list, event details, report access, and invoices.</p>
                </Link>
                <Link href="/taster/tastings/reports" className="rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <p className="font-medium text-slate-900">Report Center</p>
                  <p className="mt-1 text-xs text-slate-500">Jump directly into post-event reporting and submitted history.</p>
                </Link>
                <Link href="/taster/availability" className="rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <p className="font-medium text-slate-900">Availability Calendar</p>
                  <p className="mt-1 text-xs text-slate-500">Keep scheduling current so admins place you accurately.</p>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                  Contact & Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">Email</p>
                    <p className="text-xs text-slate-500">{user?.email ?? 'No email on file'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">Phone</p>
                    <p className="text-xs text-slate-500">{user?.phone ?? 'No phone on file'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">Notification mode</p>
                    <p className="text-xs text-slate-500">
                      Email {preferences.emailNotificationsEnabled ? 'on' : 'off'} · SMS {preferences.smsNotificationsEnabled ? 'on' : 'off'} · In-app {preferences.inAppNotificationsEnabled ? 'on' : 'off'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <IndustryNewsWidget audience="taster" />
          </div>
        </div>
      </div>
    )
  } catch (error) {
    if (!isMissingTastingsTable(error)) throw error

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The tasting tables are not in this database yet. Run `npm run db:migrate` before using tasting scheduling in production.
        </div>
      </div>
    )
  }
}
