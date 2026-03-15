import { desc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/db'
import { notificationsLog, scheduledSmsJobs } from '@/db/schema'
import { JobsOverview } from '@/components/ops/JobsOverview'

function isMissingOpsTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    (message.includes('scheduled_sms_jobs') && message.includes('does not exist')) ||
    (message.includes('notifications_log') && message.includes('does not exist'))
  )
}

export default async function AdminJobsPage() {
  await requireAdmin()

  try {
    const [smsJobs, notificationRows] = await Promise.all([
      db
        .select({
          id: scheduledSmsJobs.id,
          templateKey: scheduledSmsJobs.templateKey,
          phoneNumber: scheduledSmsJobs.phoneNumber,
          status: scheduledSmsJobs.status,
          sendAt: scheduledSmsJobs.sendAt,
          sentAt: scheduledSmsJobs.sentAt,
          createdAt: scheduledSmsJobs.createdAt,
          lastError: scheduledSmsJobs.lastError,
        })
        .from(scheduledSmsJobs)
        .orderBy(desc(scheduledSmsJobs.createdAt))
        .limit(50),
      db
        .select({
          id: notificationsLog.id,
          type: notificationsLog.type,
          recipientPhone: notificationsLog.recipientPhone,
          recipientName: notificationsLog.recipientName,
          status: notificationsLog.status,
          message: notificationsLog.message,
          sentAt: notificationsLog.sentAt,
        })
        .from(notificationsLog)
        .orderBy(desc(notificationsLog.sentAt))
        .limit(50),
    ])

    const rows = [
      ...smsJobs.map((job) => ({
        id: String(job.id),
        type: 'scheduled_sms',
        status: job.status === 'pending' ? 'pending' : job.status === 'failed' ? 'failed' : 'sent',
        target: job.phoneNumber,
        detail: job.templateKey,
        scheduledFor: job.sendAt,
        completedAt: job.sentAt,
        createdAt: job.createdAt,
        lastError: job.lastError,
      })),
      ...notificationRows.map((row) => ({
        id: String(row.id),
        type: `${row.type}_send`,
        status: row.status === 'failed' ? 'failed' : 'sent',
        target: row.recipientName || row.recipientPhone || 'Unknown recipient',
        detail: row.message,
        scheduledFor: row.sentAt,
        completedAt: row.sentAt,
        createdAt: row.sentAt,
        lastError: row.status === 'failed' ? 'Delivery failed' : null,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100)

    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Background Jobs</h1>
          <p className="mt-1 text-muted-foreground">See queued, sent, failed, and retrying operational jobs in one place.</p>
        </div>
        <JobsOverview rows={rows} />
      </div>
    )
  } catch (error) {
    if (!isMissingOpsTable(error)) throw error

    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Background Jobs</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The jobs tables are not fully available in this database yet. Run `npm run db:migrate` before using the jobs view in production.
        </div>
      </div>
    )
  }
}
