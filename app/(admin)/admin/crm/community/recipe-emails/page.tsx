import Link from 'next/link'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { ArrowLeft, ExternalLink, Eye, MailX, Send, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/db'
import { activityEvents, communityContacts, communityRecipeEmails } from '@/db/schema'
import { RecipeEmailTrendChart, type RecipeEmailTrendPoint } from '@/components/marketing/RecipeEmailTrendChart'
import { requireFeature } from '@/lib/auth/session'
import {
  COMMUNITY_UNSUBSCRIBE_KIND,
  UNSUBSCRIBE_REASON_LABELS,
  type CommunityUnsubscribeReason,
} from '@/lib/marketing/community-email-events'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_VARIANTS = { sent: 'success', sending: 'info', failed: 'destructive' } as const

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

/** Mirrors the vercel.json schedule: Thursdays at 15:00 UTC. */
function nextScheduledSend(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15))
  next.setUTCDate(next.getUTCDate() + ((4 - next.getUTCDay() + 7) % 7))
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7)
  return next
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function percent(part: number, whole: number) {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—'
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Icon className="h-4 w-4 text-[#ff5a00]" />{label}</div>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  )
}

export default async function RecipeEmailsPage() {
  await requireFeature('crm', 'admin')
  const thirtyDaysAgo = daysAgo(30)

  const [sends, statusCounts, recentUnsubscribes, unsubscribesLast30] = await Promise.all([
    db.select().from(communityRecipeEmails).orderBy(desc(communityRecipeEmails.weekKey)).limit(52).catch(() => null),
    db.select({ status: communityContacts.status, total: count() }).from(communityContacts).groupBy(communityContacts.status),
    db
      .select({
        id: activityEvents.id,
        createdAt: activityEvents.createdAt,
        metadata: activityEvents.metadata,
        contactId: communityContacts.id,
        firstName: communityContacts.firstName,
        lastName: communityContacts.lastName,
        email: communityContacts.email,
      })
      .from(activityEvents)
      .innerJoin(communityContacts, eq(activityEvents.entityId, communityContacts.id))
      .where(and(eq(activityEvents.entityType, 'community_contact'), eq(activityEvents.kind, COMMUNITY_UNSUBSCRIBE_KIND)))
      .orderBy(desc(activityEvents.createdAt))
      .limit(30)
      .catch(() => []),
    db
      .select({ total: count() })
      .from(activityEvents)
      .where(and(eq(activityEvents.kind, COMMUNITY_UNSUBSCRIBE_KIND), gte(activityEvents.createdAt, thirtyDaysAgo)))
      .then((rows) => rows[0]?.total ?? 0)
      .catch(() => 0),
  ])

  const subscribed = statusCounts.find((row) => row.status === 'subscribed')?.total ?? 0
  const unsubscribed = statusCounts.find((row) => row.status === 'unsubscribed')?.total ?? 0
  const totalSent = (sends ?? []).reduce((sum, row) => sum + row.sentCount, 0)
  const trend: RecipeEmailTrendPoint[] = [...(sends ?? [])].reverse().map((row) => ({
    week: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${row.weekKey}T12:00:00Z`)),
    sent: row.sentCount,
    unsubscribed: row.unsubscribeCount,
    complaints: row.complaintCount,
    bounced: row.bounceCount,
  }))

  return (
    <div className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon"><Link href="/admin/crm?tab=community-contacts" aria-label="Back to community contacts"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="font-display text-3xl font-bold uppercase text-slate-950 sm:text-4xl">Weekly recipe emails</h1>
            <p className="mt-1 text-sm text-slate-500">Wisher cocktail of the week, sent to subscribed community contacts every Thursday.</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <a href="/api/admin/weekly-recipe-email/preview" target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />Preview next email</a>
        </Button>
      </div>

      {sends === null ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          The send history table isn’t in the database yet. Run <code>npm run db:migrate</code> to create it.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Subscribed" value={subscribed.toLocaleString()} hint="Will receive the next email" />
        <StatCard icon={MailX} label="Unsubscribed" value={unsubscribed.toLocaleString()} hint={`${unsubscribesLast30.toLocaleString()} in the last 30 days`} />
        <StatCard icon={Send} label="Emails delivered to Resend" value={totalSent.toLocaleString()} hint={`Across ${(sends ?? []).length} weekly sends`} />
        <StatCard icon={Send} label="Next send" value={formatDate(nextScheduledSend())} hint={`${formatDateTime(nextScheduledSend())} ET`} />
      </div>

      <Card className="shadow-none">
        <CardHeader><CardTitle>Trends</CardTitle></CardHeader>
        <CardContent>
          {trend.length ? <RecipeEmailTrendChart data={trend} /> : <p className="text-sm text-slate-500">Charts appear after the first weekly email goes out.</p>}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader><CardTitle>Send history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-y bg-[#f4f1ed] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Week of</th>
                  <th className="px-4 py-3 text-left">Recipe</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Sent</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3 text-right">Bounced</th>
                  <th className="px-4 py-3 text-right">Spam</th>
                  <th className="px-4 py-3 text-right">Unsubscribed</th>
                  <th className="px-4 py-3 text-right">Unsub rate</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Email</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(sends ?? []).map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDate(`${row.weekKey}T12:00:00Z`)}
                      <p className="text-xs text-slate-400">{formatDateTime(row.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <a href={row.recipeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline">{row.recipeTitle}<ExternalLink className="h-3 w-3 text-slate-400" /></a>
                      <p className="text-xs text-slate-500">{row.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[row.status]}>{row.status}</Badge>
                      {row.error ? <p className="mt-1 max-w-48 text-xs text-red-600">{row.error}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.sentCount.toLocaleString()}<span className="text-slate-400"> / {row.recipientCount.toLocaleString()}</span></td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.failedCount ? 'text-red-600' : 'text-slate-500'}`}>{row.failedCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.bounceCount.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.complaintCount ? 'text-red-600' : 'text-slate-700'}`}>{row.complaintCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.unsubscribeCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{percent(row.unsubscribeCount + row.complaintCount, row.sentCount)}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/api/admin/weekly-recipe-email/preview?week=${row.weekKey}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#ff5a00] hover:underline"><Eye className="h-3.5 w-3.5" />View email</a>
                    </td>
                  </tr>
                ))}
                {!(sends ?? []).length ? (
                  <tr><td colSpan={10}className="px-4 py-8 text-center text-slate-500">No weekly recipe emails have been sent yet. The first one goes out {formatDateTime(nextScheduledSend())} ET.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader><CardTitle>Recent unsubscribes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentUnsubscribes.length ? recentUnsubscribes.map((row) => {
            const metadata = row.metadata as { reason?: CommunityUnsubscribeReason; weekKey?: string | null }
            const reason = metadata.reason ? UNSUBSCRIBE_REASON_LABELS[metadata.reason] : 'Unsubscribed'
            const isAutomatic = metadata.reason === 'bounce' || metadata.reason === 'complaint' || metadata.reason === 'suppressed'
            return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <Link href={`/admin/crm/community/${row.contactId}`} className="font-semibold text-slate-900 hover:underline">{`${row.firstName} ${row.lastName}`.trim()}</Link>
                  <p className="text-xs text-slate-500">{row.email}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <Badge variant={isAutomatic ? 'warning' : 'outline'}>{reason}</Badge>
                  <span className="text-xs text-slate-400">{formatDateTime(row.createdAt)}{metadata.weekKey ? ` · week of ${formatDate(`${metadata.weekKey}T12:00:00Z`)}` : ''}</span>
                </div>
              </div>
            )
          }) : <p className="text-sm text-slate-500">No one has unsubscribed yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
