import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { db } from '@/db'
import { activityEvents, notificationsLog, wholesaleAccountRequests } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const snapshotSchema = z.object({
  to: z.array(z.string()), from: z.string(), subject: z.string(), html: z.string(),
  status: z.enum(['sent', 'failed']), activationLinkHidden: z.boolean().optional(),
})

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' }).format(date)
}

export default async function WholesaleRequestEmailsPage({ params }: { params: Promise<{ requestId: string }> }) {
  await requireAdmin()
  const { requestId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) notFound()
  const [request] = await db.select().from(wholesaleAccountRequests).where(eq(wholesaleAccountRequests.id, requestId)).limit(1)
  if (!request) notFound()

  const [snapshots, logs] = await Promise.all([
    db.select({ id: activityEvents.id, metadata: activityEvents.metadata, createdAt: activityEvents.createdAt })
      .from(activityEvents).where(and(
        eq(activityEvents.entityType, 'wholesale_request'),
        eq(activityEvents.entityId, requestId),
        eq(activityEvents.kind, 'wholesale_request_email_snapshot'),
      )).orderBy(desc(activityEvents.createdAt)).limit(100),
    // Older sending code stored subjects, not bodies or request IDs. Label these
    // as logs for the recipient address instead of claiming exact request linkage.
    db.select().from(notificationsLog).where(and(
      eq(notificationsLog.type, 'email'),
      sql`lower(${notificationsLog.recipientPhone}) = ${request.businessEmail.toLowerCase()}`,
      gte(notificationsLog.sentAt, request.createdAt),
      inArray(notificationsLog.message, [
        `Activate ${request.businessName}'s AHAWC portal account`,
        `${request.businessName}'s AHAWC portal access is ready`,
        `${request.businessName} has been approved for the AHAWC Portal`,
      ]),
    )).orderBy(desc(notificationsLog.sentAt)).limit(100),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon"><Link href="/admin/wholesale-requests" aria-label="Back to wholesaler requests"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div><h1 className="text-2xl font-bold text-slate-900">Approval emails</h1><p className="mt-1 text-sm text-slate-600">{request.businessName} · {request.businessEmail}</p></div>
      </div>
      <p className="text-sm text-slate-500">Sent means accepted by the email service, not confirmed inbox delivery. Times shown in Central Time.</p>
      {snapshots.map(row => {
        const parsed = snapshotSchema.safeParse(row.metadata)
        if (!parsed.success) return <Card key={row.id}><CardContent className="p-5 text-sm text-slate-500">The saved email from {dateLabel(row.createdAt)} could not be displayed.</CardContent></Card>
        const email = parsed.data
        return (
          <Card key={row.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{email.subject}</CardTitle><Badge variant={email.status === 'sent' ? 'success' : 'destructive'}>{email.status}</Badge></div>
              <p className="text-sm text-slate-600">To: {email.to.join(', ')}<br />From: {email.from}<br />{dateLabel(row.createdAt)}</p>
              {email.activationLinkHidden ? <p className="text-xs text-slate-500">The private activation link is hidden in this copy.</p> : null}
            </CardHeader>
            <CardContent><iframe title={`Email: ${email.subject} — ${row.id}`} srcDoc={email.html} sandbox="" referrerPolicy="no-referrer" className="min-h-[560px] w-full rounded-lg border bg-white" /></CardContent>
          </Card>
        )
      })}
      {!snapshots.length ? <Card><CardContent className="p-5 text-sm text-slate-600">No saved email body is available for this request. Earlier emails only recorded the subject and send status. New approvals and approval resends will save a viewable copy.</CardContent></Card> : null}
      <Card>
        <CardHeader><CardTitle>Email logs for this address</CardTitle><p className="text-sm text-slate-500">Approval and activation emails recorded since this request was submitted. Older records do not include the email body.</p></CardHeader>
        <CardContent className="space-y-3">
          {logs.map(log => <div key={log.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"><div><p className="font-medium text-slate-900">{log.message}</p><p className="text-sm text-slate-500">To: {log.recipientPhone} · {dateLabel(log.sentAt)}</p></div><Badge variant={log.status === 'failed' ? 'destructive' : log.status === 'sent' ? 'success' : 'outline'}>{log.status}</Badge></div>)}
          {!logs.length ? <p className="text-sm text-slate-500">No approval email logs were found for this address.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
