import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { db } from '@/db'
import { wholesaleAccountRequests } from '@/db/schema'
import { desc } from 'drizzle-orm'

type WholesaleRequestRow = {
  id: string
  businessName: string
  businessEmail: string
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
  let requests: WholesaleRequestRow[] = []
  let tableUnavailable = false

  try {
    requests = await db
      .select()
      .from(wholesaleAccountRequests)
      .orderBy(desc(wholesaleAccountRequests.createdAt))
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Recent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-slate-900">
              {requests[0] ? formatDateTime(requests[0].createdAt) : 'No submissions yet'}
            </p>
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{request.businessName}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Submitted {formatDateTime(request.createdAt)}
                      </p>
                    </div>
                    <Badge variant={request.smsOptIn ? 'success' : 'secondary'}>
                      {request.smsOptIn ? 'SMS Opt-In' : 'No SMS Opt-In'}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
