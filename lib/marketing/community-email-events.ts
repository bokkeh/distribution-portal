import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { communityContacts, communityRecipeEmails } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'

export const COMMUNITY_UNSUBSCRIBE_KIND = 'community_contact_unsubscribed'

export type CommunityUnsubscribeReason = 'link' | 'one_click' | 'bounce' | 'complaint' | 'suppressed'

export const UNSUBSCRIBE_REASON_LABELS: Record<CommunityUnsubscribeReason, string> = {
  link: 'Unsubscribe link',
  one_click: 'Mail app unsubscribe button',
  bounce: 'Hard bounce',
  complaint: 'Marked as spam',
  suppressed: 'Resend suppression list',
}

const TITLES: Record<CommunityUnsubscribeReason, string> = {
  link: 'Unsubscribed from community emails',
  one_click: 'Unsubscribed from community emails',
  bounce: 'Email bounced, unsubscribed automatically',
  complaint: 'Marked an email as spam, unsubscribed automatically',
  suppressed: 'Email address suppressed by Resend, unsubscribed automatically',
}

const WEEK_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseWeekKey(value: string | null | undefined) {
  return value && WEEK_KEY_PATTERN.test(value) ? value : null
}

function describe(reason: CommunityUnsubscribeReason, weekKey: string | null, detail?: string | null) {
  const source = weekKey ? ` the weekly recipe email (week of ${weekKey})` : ' a community email'
  const base = {
    link: `Used the unsubscribe link in${source}.`,
    one_click: `Used their mail app’s unsubscribe button on${source}.`,
    bounce: `A permanent bounce was reported for${source}.`,
    complaint: `Reported${source} as spam.`,
    suppressed: `Resend refused to deliver${source} because the address is on its suppression list.`,
  }[reason]
  return detail ? `${base} ${detail}` : base
}

/** Adds to a weekly send's engagement counters; a no-op when the email wasn't a tagged weekly recipe email. */
async function incrementWeekCounter(weekKey: string | null, column: 'bounceCount' | 'complaintCount' | 'unsubscribeCount') {
  if (!weekKey) return
  const target = communityRecipeEmails[column]
  await db
    .update(communityRecipeEmails)
    .set({ [column]: sql`${target} + 1` })
    .where(eq(communityRecipeEmails.weekKey, weekKey))
}

/**
 * Marks matching subscribed community contacts as unsubscribed and logs it on each contact's timeline.
 * Counters represent newly removed contacts, not webhook deliveries. Replayed notifications
 * and a suppression following a bounce must not inflate the totals.
 */
export async function recordCommunityUnsubscribe({
  contactId,
  email,
  reason,
  weekKey = null,
  detail,
}: {
  contactId?: string
  email?: string
  reason: CommunityUnsubscribeReason
  weekKey?: string | null
  detail?: string | null
}) {
  const match = contactId
    ? eq(communityContacts.id, contactId)
    : email
      ? sql`lower(${communityContacts.email}) = ${email.trim().toLowerCase()}`
      : null
  if (!match) return 0

  const changed = await db
    .update(communityContacts)
    .set({ status: 'unsubscribed', updatedAt: new Date() })
    .where(and(match, eq(communityContacts.status, 'subscribed')))
    .returning({ id: communityContacts.id })

  await Promise.all(changed.map((row) =>
    logActivityEvent({
      entityType: 'community_contact',
      entityId: row.id,
      kind: COMMUNITY_UNSUBSCRIBE_KIND,
      title: TITLES[reason],
      body: describe(reason, weekKey, detail),
      metadata: { reason, weekKey },
    }),
  ))

  try {
    if (!changed.length) return 0
    if (reason === 'complaint') await incrementWeekCounter(weekKey, 'complaintCount')
    else if (reason === 'bounce' || reason === 'suppressed') await incrementWeekCounter(weekKey, 'bounceCount')
    else if (changed.length) await incrementWeekCounter(weekKey, 'unsubscribeCount')
  } catch (error) {
    console.error('Failed to update weekly recipe email counters:', error)
  }

  return changed.length
}
