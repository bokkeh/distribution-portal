import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { activityEvents, users, wholesaleAccountRequests } from '@/db/schema'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { updateWholesaleRequestWorkflow } from '@/actions/wholesale-requests'
import { SendInvitationModal } from '@/components/wholesale-requests/SendInvitationModal'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

type WholesaleRequestRow = {
  id: string
  businessName: string
  businessEmail: string
  businessType: string | null
  phone: string | null
  phoneNormalized: string | null
  smsOptIn: boolean
  smsOptInAt: Date | null
  smsConsentLanguage: string | null
  source: string
  submissionPage: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

function formatDateTime(value: Date | null) {
  if (!value) return 'Not provided'
  return new Date(value).toLocaleString()
}

export default async function WholesaleRequestsPage() {
  async function submitWorkflow(formData: FormData) {
    'use server'
    await updateWholesaleRequestWorkflow(formData)
  }

  let requests: WholesaleRequestRow[] = []
  let tableUnavailable = false
  let requestWorkflowEvents: Array<{
    entityId: string
    body: string | null
    metadata: unknown
    createdAt: Date
  }> = []
  let assignableUsers: Array<{ id: string; name: string }> = []

  try {
    requests = await db
      .select()
      .from(wholesaleAccountRequests)
      .orderBy(desc(wholesaleAccountRequests.createdAt))

    const requestIds = requests.map((request) => request.id)
    if (requestIds.length) {
      requestWorkflowEvents = await db
        .select({
          entityId: activityEvents.entityId,
          body: activityEvents.body,
          metadata: activityEvents.metadata,
          createdAt: activityEvents.createdAt,
        })
        .from(activityEvents)
        .where(and(eq(activityEvents.entityType, 'wholesale_request'), inArray(activityEvents.entityId, requestIds)))
        .orderBy(desc(activityEvents.createdAt))
    }

    assignableUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name))
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
      ?? (error as { cause?: { code?: string } } | null)?.cause?.code
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (code === '42P01' || message.includes('wholesale_account_requests')) {
      tableUnavailable = true
    } else {
      throw error
    }
  }

  const optedInCount = requests.filter(request => request.smsOptIn).length
  const workflowMap = new Map<string, {
    status: string
    assigneeUserId: string | null
    assigneeName: string | null
    notes: string | null
    updatedAt: Date | null
  }>()

  for (const event of requestWorkflowEvents) {
    if (workflowMap.has(event.entityId)) continue
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {}
    workflowMap.set(event.entityId, {
      status: typeof metadata.status === 'string' ? metadata.status : 'new',
      assigneeUserId: typeof metadata.assigneeUserId === 'string' ? metadata.assigneeUserId : null,
      assigneeName: typeof metadata.assigneeName === 'string' ? metadata.assigneeName : null,
      notes: typeof metadata.notes === 'string' ? metadata.notes : null,
      updatedAt: event.createdAt,
    })
  }

  const openCount = requests.filter((request) => {
    const state = workflowMap.get(request.id)?.status ?? 'new'
    return !['approved', 'rejected', 'resolved'].includes(state)
  }).length
  const escalatedCount = requests.filter((request) => (workflowMap.get(request.id)?.status ?? 'new') === 'escalated').length

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wholesaler Requests</h1>
          <p className="mt-1 text-muted-foreground">
            {tableUnavailable
              ? 'Requests will appear here after the wholesale request table is migrated.'
              : `${requests.length} submissions, ${optedInCount} opted into SMS`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/join" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View Landing Page
            </Button>
          </Link>
          <SendInvitationModal />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{requests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SMS Opt-Ins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{optedInCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open / Escalated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{openCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">{escalatedCount} escalated</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {tableUnavailable ? (
            <p className="text-sm text-muted-foreground">
              The active database does not currently have the `wholesale_account_requests` table. Run the wholesale request migration against the production database to review submissions here.
            </p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wholesale requests have been submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {requests.map(request => (
                <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                  {(() => {
                    const workflow = workflowMap.get(request.id)
                    const status = workflow?.status ?? 'new'
                    return (
                      <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{request.businessName}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Submitted {formatDateTime(request.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={request.smsOptIn ? 'success' : 'secondary'}>
                        {request.smsOptIn ? 'SMS Opt-In' : 'No SMS Opt-In'}
                      </Badge>
                      <Badge variant={status === 'approved' || status === 'resolved' ? 'success' : status === 'rejected' ? 'destructive' : status === 'escalated' ? 'warning' : 'secondary'}>
                        {status}
                      </Badge>
                      <SendInvitationModal
                        defaultEmail={request.businessEmail}
                        defaultMessage={status === 'approved' ? `Your wholesale request for ${request.businessName} was approved. If you still need the portal link, here it is again.` : ''}
                        triggerLabel={status === 'approved' ? 'Resend Invite' : 'Send Invite'}
                        triggerVariant="outline"
                        title={status === 'approved' ? 'Resend Invitation' : 'Send Invitation'}
                        description={status === 'approved' ? 'Resend the portal access email if the customer cannot find it.' : 'Send this request a portal invitation email.'}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business Type</p>
                      <p className="text-sm text-slate-900">{request.businessType ? request.businessType.replaceAll('_', ' ') : 'Not provided'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                      <a href={`mailto:${request.businessEmail}`} className="text-sm text-slate-900 underline-offset-4 hover:underline">
                        {request.businessEmail}
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
                      <a href={request.phone ? `tel:${request.phone}` : undefined} className="text-sm text-slate-900 underline-offset-4 hover:underline">
                        {request.phone ?? 'Not provided'}
                      </a>
                      {request.phoneNormalized && (
                        <p className="text-xs text-muted-foreground">Normalized: {request.phoneNormalized}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</p>
                      <p className="text-sm text-slate-900">{request.source}</p>
                      <p className="text-xs text-muted-foreground">{request.submissionPage ?? 'No submission page recorded'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SMS Consent Timestamp</p>
                      <p className="text-sm text-slate-900">{formatDateTime(request.smsOptInAt)}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SMS Consent Language</p>
                      <p className="text-sm text-slate-900">{request.smsConsentLanguage ?? 'Not provided'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IP Address</p>
                      <p className="text-sm text-slate-900">{request.ipAddress ?? 'Not recorded'}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">User Agent</p>
                      <p className="break-words text-sm text-slate-900">{request.userAgent ?? 'Not recorded'}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</p>
                        <p className="mt-1 text-sm text-slate-900">
                          Owner: {workflow?.assigneeName ?? 'Unassigned'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last updated: {workflow?.updatedAt ? formatDateTime(workflow.updatedAt) : 'Not reviewed yet'}
                        </p>
                        {workflow?.notes ? (
                          <p className="mt-2 text-sm text-slate-600">{workflow.notes}</p>
                        ) : null}
                      </div>
                    </div>
                    <form action={submitWorkflow} className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_160px_auto]">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        name="notes"
                        defaultValue={workflow?.notes ?? ''}
                        placeholder="Add review notes, escalation context, or follow-up details"
                        className="flex h-10 rounded-md border border-input bg-white px-3 text-sm"
                      />
                      <select name="assigneeUserId" defaultValue={workflow?.assigneeUserId ?? ''} className="flex h-10 rounded-md border border-input bg-white px-3 text-sm">
                        <option value="">Unassigned</option>
                        {assignableUsers.map((user) => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                      <select name="status" defaultValue={status} className="flex h-10 rounded-md border border-input bg-white px-3 text-sm">
                        <option value="new">New</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="escalated">Escalated</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <Button type="submit" variant="outline">Update</Button>
                    </form>
                  </div>
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
