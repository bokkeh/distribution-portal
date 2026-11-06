import { getRecipeEmailEngagement, getRecipeEmailRecipientEngagement } from '@/lib/marketing/recipe-email-engagement-data'
import { RecipeEmailEngagementSummary } from '@/components/marketing/RecipeEmailEngagement'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import { activityEvents, communityContactCommunications, communityContacts, communityRecipeEmails } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { COMMUNITY_UNSUBSCRIBE_KIND, UNSUBSCRIBE_REASON_LABELS, type CommunityUnsubscribeReason } from '@/lib/marketing/community-email-events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function RecipeEmailRecipientsPage({ params }: { params: Promise<{ sendId: string }> }) {
  await requireFeature('crm', 'admin')
  const { sendId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sendId)) notFound()
  const [send] = await db.select().from(communityRecipeEmails).where(eq(communityRecipeEmails.id, sendId)).limit(1)
  if (!send) notFound()

  // Legacy campaigns do not have a campaign foreign key on their communication logs.
  // Match the exact recipe/subject within this run, never the current subscription list.
  const [recipients, events] = await Promise.all([
    db.select({
      id: communityContactCommunications.id,
      contactId: communityContacts.id,
      firstName: communityContacts.firstName,
      lastName: communityContacts.lastName,
      email: communityContacts.email,
      status: communityContactCommunications.status,
      occurredAt: communityContactCommunications.occurredAt,
    }).from(communityContactCommunications)
      .innerJoin(communityContacts, eq(communityContacts.id, communityContactCommunications.communityContactId))
      .where(and(
        eq(communityContactCommunications.channel, 'email'),
        eq(communityContactCommunications.direction, 'outbound'),
        eq(communityContactCommunications.subject, send.subject),
        eq(communityContactCommunications.body, `Weekly Wisher recipe: ${send.recipeTitle} (${send.recipeUrl})`),
        gte(communityContactCommunications.occurredAt, send.createdAt),
        lte(communityContactCommunications.occurredAt, send.completedAt ?? new Date()),
      ))
      .orderBy(asc(communityContacts.lastName), asc(communityContacts.firstName), asc(communityContacts.email)),
    db.select({ contactId: activityEvents.entityId, metadata: activityEvents.metadata, detail: activityEvents.body })
      .from(activityEvents)
      .where(and(
        eq(activityEvents.entityType, 'community_contact'),
        eq(activityEvents.kind, COMMUNITY_UNSUBSCRIBE_KIND),
        sql`${activityEvents.metadata}->>'weekKey' = ${send.weekKey}`,
      )).orderBy(desc(activityEvents.createdAt)),
  ])
  const [metrics, recipientEngagement] = await Promise.all([getRecipeEmailEngagement([send]).catch(() => null), getRecipeEmailRecipientEngagement(send.id).catch(() => null)])
  const engagement = metrics?.get(send.id)
  const unavailable = metrics === null || recipientEngagement === null
  const outcomes = new Map<string, typeof events[number]>()
  for (const event of events) if (!outcomes.has(event.contactId)) outcomes.set(event.contactId, event)

  return (
    <div className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon"><Link href="/admin/crm/community/recipe-emails" aria-label="Back to send history"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="font-display text-3xl font-bold uppercase text-slate-950">Email recipients</h1>
          <p className="mt-1 text-sm text-slate-600">{send.recipeTitle} · Week of {send.weekKey}</p>
        </div>
      </div>
      <RecipeEmailEngagementSummary campaigns={engagement ? [engagement] : []} unavailable={unavailable} />
      <Card className="shadow-none"><CardHeader><CardTitle>Marketing links clicked</CardTitle></CardHeader><CardContent className="space-y-2">{engagement?.links.length ? engagement.links.map(link => <div key={link.url} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm"><span className="min-w-0 break-all">{link.url}</span><strong>{link.recipients} unique recipients</strong></div>) : <p className="text-sm text-slate-500">{unavailable ? 'Engagement data is unavailable.' : engagement?.tracked ? 'No marketing link clicks recorded yet.' : 'This send was not tracked.'}</p>}</CardContent></Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{send.subject}</CardTitle>
          <p className="text-sm text-slate-500">{recipients.length} recorded recipients of {send.recipientCount} intended. Sent means accepted by the email service; it does not confirm inbox delivery. Names and email addresses reflect current contact details.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-y bg-[#f4f1ed] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Send status</th><th className="px-4 py-3">Opened</th><th className="px-4 py-3">Clicked</th><th className="px-4 py-3">Reported outcome</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipients.map((recipient) => {
                  const signals = recipientEngagement?.get(recipient.contactId)
                  const signalLabel = (value: string | null | undefined) => unavailable ? 'Unavailable' : !engagement?.tracked ? 'Not tracked' : value ? new Date(value).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET' : 'Not recorded'
                  const event = outcomes.get(recipient.contactId)
                  const reason = (event?.metadata as { reason?: string } | undefined)?.reason
                  const label = reason && Object.hasOwn(UNSUBSCRIBE_REASON_LABELS, reason) ? UNSUBSCRIBE_REASON_LABELS[reason as CommunityUnsubscribeReason] : null
                  return (
                    <tr key={recipient.id} className="align-top">
                      <td className="px-4 py-3"><Link href={`/admin/crm/community/${recipient.contactId}`} className="font-semibold text-slate-900 hover:underline">{`${recipient.firstName} ${recipient.lastName}`.trim()}</Link></td>
                      <td className="px-4 py-3 text-slate-700">{recipient.email}</td>
                      <td className="px-4 py-3"><Badge variant={recipient.status === 'sent' ? 'success' : 'destructive'}>{recipient.status}</Badge></td>
                      <td className="px-4 py-3 text-sm text-slate-700">{signalLabel(signals?.openedAt)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{signalLabel(signals?.clickedAt)}</td>
                      <td className="px-4 py-3">
                        {label ? <><Badge variant={reason === 'link' || reason === 'one_click' ? 'outline' : 'warning'}>{label}</Badge><p className="mt-1 max-w-md text-xs text-slate-500">{event?.detail}</p></> : <span className="text-slate-500">No outcome recorded</span>}
                      </td>
                    </tr>
                  )
                })}
                {!recipients.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No recipient logs are available for this send.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
