'use server'

import { eq } from 'drizzle-orm'
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

  await db
    .update(scheduledSmsJobs)
    .set({
      status: 'pending',
      sendAt: new Date(),
      lastError: null,
      sentAt: null,
    })
    .where(eq(scheduledSmsJobs.id, jobId))

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
