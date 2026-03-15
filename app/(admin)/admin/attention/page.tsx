import Link from 'next/link'
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { AlertTriangle, ArrowRight, ClipboardList, MessageSquare, Receipt, Store, TriangleAlert } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/db'
import { customerAccounts, replyTemplates, scheduledSmsJobs, smsThreads, tasterInvoices, tastingReports, tastings, userNotifications, wholesaleAccountRequests } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function AdminAttentionPage() {
  await requireAdmin()

  const [
    wholesaleRequests,
    openThreads,
    failedJobs,
    missingReports,
    submittedInvoices,
    notificationsNeedingReview,
    replyTemplateCount,
  ] = await Promise.all([
    db.select({
      id: wholesaleAccountRequests.id,
      businessName: wholesaleAccountRequests.businessName,
      businessEmail: wholesaleAccountRequests.businessEmail,
      createdAt: wholesaleAccountRequests.createdAt,
    }).from(wholesaleAccountRequests).orderBy(desc(wholesaleAccountRequests.createdAt)).limit(8),
    db.select({
      phoneNumber: smsThreads.phoneNumber,
      status: smsThreads.status,
      priority: smsThreads.priority,
      assignedUserId: smsThreads.assignedUserId,
      lastMessageAt: smsThreads.lastMessageAt,
      companyName: customerAccounts.companyName,
    }).from(smsThreads)
      .leftJoin(customerAccounts, eq(smsThreads.customerId, customerAccounts.id))
      .where(or(eq(smsThreads.status, 'open'), eq(smsThreads.priority, 'starred')))
      .orderBy(desc(smsThreads.lastMessageAt))
      .limit(10),
    db.select({
      id: scheduledSmsJobs.id,
      templateKey: scheduledSmsJobs.templateKey,
      phoneNumber: scheduledSmsJobs.phoneNumber,
      lastError: scheduledSmsJobs.lastError,
      createdAt: scheduledSmsJobs.createdAt,
    }).from(scheduledSmsJobs).where(eq(scheduledSmsJobs.status, 'failed')).orderBy(desc(scheduledSmsJobs.createdAt)).limit(8),
    db.select({
      id: tastings.id,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      customerId: tastings.customerId,
      companyName: customerAccounts.companyName,
    }).from(tastings)
      .leftJoin(tastingReports, eq(tastings.id, tastingReports.tastingId))
      .leftJoin(customerAccounts, eq(tastings.customerId, customerAccounts.id))
      .where(and(eq(tastings.status, 'completed'), isNull(tastingReports.id)))
      .orderBy(desc(tastings.scheduledAt))
      .limit(8),
    db.select({
      id: tasterInvoices.id,
      tastingId: tasterInvoices.tastingId,
      payeeName: tasterInvoices.payeeName,
      totalAmount: tasterInvoices.totalAmount,
      submittedAt: tasterInvoices.submittedAt,
      status: tasterInvoices.status,
    }).from(tasterInvoices)
      .where(eq(tasterInvoices.status, 'submitted'))
      .orderBy(desc(tasterInvoices.submittedAt))
      .limit(8),
    db.select({
      id: userNotifications.id,
      title: userNotifications.title,
      href: userNotifications.href,
      createdAt: userNotifications.createdAt,
    }).from(userNotifications)
      .where(isNull(userNotifications.readAt))
      .orderBy(desc(userNotifications.createdAt))
      .limit(8),
    db.select({ count: sql<number>`count(*)` }).from(replyTemplates),
  ])

  const inboxEscalations = openThreads.filter((thread) => !thread.assignedUserId || thread.priority === 'starred')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Needs Attention</h1>
        <p className="mt-1 text-muted-foreground">Unified queue for approvals, follow-up work, failed jobs, and unowned communication.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Wholesaler Requests', value: wholesaleRequests.length, icon: Store },
          { label: 'Open SMS Threads', value: inboxEscalations.length, icon: MessageSquare },
          { label: 'Failed Jobs', value: failedJobs.length, icon: TriangleAlert },
          { label: 'Missing Reports', value: missingReports.length, icon: ClipboardList },
          { label: 'Submitted Invoices', value: submittedInvoices.length, icon: Receipt },
          { label: 'Reply Templates', value: replyTemplateCount[0]?.count ?? 0, icon: AlertTriangle },
        ].map((item) => (
          <Card key={item.label} className="border-0 bg-white shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{item.value}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <QueueCard title="New Wholesaler Requests" href="/admin/wholesale-requests">
          {wholesaleRequests.map((request) => (
            <QueueRow
              key={request.id}
              title={request.businessName}
              subtitle={request.businessEmail}
              meta={formatDate(request.createdAt)}
              href="/admin/wholesale-requests"
            />
          ))}
        </QueueCard>

        <QueueCard title="Inbox Threads Needing Ownership" href="/admin/inbox">
          {inboxEscalations.map((thread) => (
            <QueueRow
              key={thread.phoneNumber}
              title={thread.companyName ?? thread.phoneNumber}
              subtitle={`${thread.phoneNumber} • ${thread.assignedUserId ? 'Starred' : 'Unassigned'}`}
              meta={formatDate(thread.lastMessageAt)}
              href={`/admin/inbox?phone=${encodeURIComponent(thread.phoneNumber)}`}
              badge={thread.priority === 'starred' ? 'Starred' : 'Unassigned'}
            />
          ))}
        </QueueCard>

        <QueueCard title="Completed Tastings Missing Reports" href="/admin/tastings">
          {missingReports.map((item) => (
            <QueueRow
              key={item.id}
              title={item.eventName}
              subtitle={item.companyName ?? 'No account linked'}
              meta={formatDate(item.scheduledAt)}
              href={`/taster/tastings/${item.id}`}
            />
          ))}
        </QueueCard>

        <QueueCard title="Submitted Taster Invoices" href="/admin/invoicing">
          {submittedInvoices.map((invoice) => (
            <QueueRow
              key={invoice.id}
              title={invoice.payeeName}
              subtitle={`Invoice submitted • $${invoice.totalAmount}`}
              meta={formatDate(invoice.submittedAt)}
              href="/admin/invoicing"
              badge={invoice.status}
            />
          ))}
        </QueueCard>

        <QueueCard title="Failed Background Jobs" href="/admin/jobs">
          {failedJobs.map((job) => (
            <QueueRow
              key={job.id}
              title={job.templateKey}
              subtitle={job.lastError || job.phoneNumber}
              meta={formatDate(job.createdAt)}
              href="/admin/jobs"
              badge="Failed"
            />
          ))}
        </QueueCard>

        <QueueCard title="Template And Notification Review" href="/admin/inbox/templates">
          {notificationsNeedingReview.map((notification) => (
            <QueueRow
              key={notification.id}
              title={notification.title}
              subtitle={notification.href ?? 'General alert'}
              meta={formatDate(notification.createdAt)}
              href={notification.href ?? '/admin/dashboard'}
            />
          ))}
        </QueueCard>
      </div>
    </div>
  )
}

function QueueCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          Open
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
      </CardContent>
    </Card>
  )
}

function QueueRow({
  title,
  subtitle,
  meta,
  href,
  badge,
}: {
  title: string
  subtitle: string
  meta: string
  href: string
  badge?: string
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 hover:border-slate-200 hover:bg-slate-100">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{title}</p>
          {badge ? <Badge variant="secondary" className="text-[10px]">{badge}</Badge> : null}
        </div>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>{meta}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  )
}
