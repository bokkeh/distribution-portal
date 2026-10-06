'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { scheduledSmsJobs } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'

export async function retryScheduledSmsJob(jobId: string) {
  const session = await requireAdmin()

  const [job] = await db
    .select()
    .from(scheduledSmsJobs)
    .where(eq(scheduledSmsJobs.id, jobId))

  if (!job) {
    throw new Error('Job not found')
  }
  if (job.status !== 'failed') throw new Error('Only failed SMS jobs can be retried. Delivery may already be in progress or complete.')

  const [retried] = await db
    .update(scheduledSmsJobs)
    .set({
      status: 'pending',
      sendAt: new Date(),
      lastError: null,
      sentAt: null,
      providerMessageId: null,
    })
    .where(and(eq(scheduledSmsJobs.id, jobId), eq(scheduledSmsJobs.status, 'failed')))
    .returning({ id: scheduledSmsJobs.id })
  if (!retried) throw new Error('This job has already been retried.')

  if (job.tastingId) {
    await logActivityEvent({
      entityType: 'tasting',
      entityId: job.tastingId,
      actorUserId: session.user.id,
      relatedUserId: job.userId,
      kind: 'scheduled_job_retried',
      title: 'Scheduled SMS retried',
      body: `${job.templateKey} was re-queued for ${job.phoneNumber}.`,
      metadata: { jobId: job.id, templateKey: job.templateKey },
    })
  }

  revalidatePath('/admin/jobs')
}
