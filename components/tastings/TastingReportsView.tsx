'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DeliveryPhotoGallery, type DeliveryGalleryPhoto } from '@/components/deliveries/DeliveryPhotoGallery'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { formatCurrency } from '@/lib/utils'
import { TastingInsightsCard } from './TastingInsightsCard'
import type { SerializedTastingAnalysis } from './TastingInsightsCard'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'

export type TastingReportRow = {
  tastingId: string
  eventName: string
  scheduledAt: Date
  status: string
  storeAddress: string | null
  storeCity: string | null
  storeState: string | null
  storeZip: string | null
  tasterName: string | null
  reportId: string | null
  actualStartTime: string | null
  actualEndTime: string | null
  samplesServed: number | null
  bottlesSold: number | null
  missedCustomers: number | null
  consumerInteractions: number | null
  bottlePriceOnShelf: string | null
  bottlesInStockBefore: number | null
  bottlesInStockAfter: number | null
  accountFeedback: string | null
  highlights: string | null
  issues: string | null
  followUpNeeded: boolean | null
  followUpNotes: string | null
  reportSubmittedAt: Date | null
  setupPhotoUrl: string | null
  shelfPhotoUrls: string[] | null
  invoiceId: string | null
  payeeName: string | null
  hourlyRate: string | null
  hoursWorked: string | null
  expenseAmount: string | null
  totalAmount: string | null
  invoiceStatus: string | null
  invoiceSubmittedAt: Date | null
}

function statusVariant(s: string): 'secondary' | 'success' | 'destructive' | 'warning' {
  if (s === 'completed') return 'success'
  if (s === 'cancelled' || s === 'declined') return 'destructive'
  if (s === 'requested') return 'warning'
  if (s === 'confirmed') return 'secondary'
  return 'secondary'
}

function invoiceStatusVariant(s: string | null): 'secondary' | 'success' | 'warning' {
  if (s === 'paid') return 'success'
  if (s === 'approved') return 'warning'
  return 'secondary'
}

function getTastingGalleryPhotos(row: TastingReportRow): DeliveryGalleryPhoto[] {
  const photos: DeliveryGalleryPhoto[] = []

  if (row.setupPhotoUrl) {
    photos.push({
      url: signedPhotoUrl(row.setupPhotoUrl) ?? row.setupPhotoUrl,
      label: 'Setup',
      stopLabel: row.eventName,
    })
  }

  for (const [index, url] of (row.shelfPhotoUrls ?? []).entries()) {
    photos.push({
      url: signedPhotoUrl(url) ?? url,
      label: `Shelf ${index + 1}`,
      stopLabel: row.eventName,
    })
  }

  return photos
}

export function TastingReportsView({
  rows,
  analysesMap = {},
}: {
  rows: TastingReportRow[]
  analysesMap?: Record<string, SerializedTastingAnalysis>
}) {
  const withReport = rows.filter((r) => r.reportId)
  const withInvoice = rows.filter((r) => r.invoiceId)
  const followUp = rows.filter((r) => r.followUpNeeded)
  const totalPayout = withInvoice.reduce((sum, r) => sum + Number(r.totalAmount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="p-6 pb-2"><p className="text-sm font-medium text-muted-foreground">Total Tastings</p></div>
          <div className="px-6 pb-6"><p className="text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        </Card>
        <Card>
          <div className="p-6 pb-2"><p className="text-sm font-medium text-muted-foreground">Reports Submitted</p></div>
          <div className="px-6 pb-6">
            <p className="text-3xl font-semibold text-slate-900">{withReport.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rows.length - withReport.length} missing</p>
          </div>
        </Card>
        <Card>
          <div className="p-6 pb-2"><p className="text-sm font-medium text-muted-foreground">Invoices Submitted</p></div>
          <div className="px-6 pb-6">
            <p className="text-3xl font-semibold text-slate-900">{withInvoice.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rows.length - withInvoice.length} missing</p>
          </div>
        </Card>
        <Card>
          <div className="p-6 pb-2"><p className="text-sm font-medium text-muted-foreground">Total Invoice Value</p></div>
          <div className="px-6 pb-6">
            <p className="text-3xl font-semibold text-slate-900">{formatCurrency(totalPayout)}</p>
            {followUp.length > 0 && <p className="mt-1 text-sm text-amber-600">{followUp.length} follow-up needed</p>}
          </div>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No tastings found.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.tastingId}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{row.eventName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatEasternDateTime(row.scheduledAt)} · {row.tasterName ?? 'Unassigned'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[row.storeAddress, row.storeCity, row.storeState, row.storeZip].filter(Boolean).join(', ') || 'No address'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    {row.reportId ? <Badge variant="success">Report submitted</Badge> : <Badge variant="secondary">No report</Badge>}
                    {row.invoiceId ? (
                      <Badge variant={invoiceStatusVariant(row.invoiceStatus)}>Invoice: {row.invoiceStatus}</Badge>
                    ) : (
                      <Badge variant="secondary">No invoice</Badge>
                    )}
                    {row.followUpNeeded && <Badge variant="warning">Follow-up needed</Badge>}
                  </div>
                </div>

                {row.reportId ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Event Report · submitted {formatEasternDateTime(row.reportSubmittedAt!)}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: 'Samples Served', value: row.samplesServed },
                        { label: 'Bottles Sold', value: row.bottlesSold },
                        { label: 'Customers Missed', value: row.missedCustomers },
                        { label: 'Consumer Interactions', value: row.consumerInteractions },
                      ].map(({ label, value }) => (
                        <div key={label} className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="text-lg font-semibold text-slate-900">{value ?? '-'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Bottle Price On Shelf</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {row.bottlePriceOnShelf != null ? formatCurrency(Number(row.bottlePriceOnShelf)) : '-'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock Before Tasting</p>
                        <p className="text-lg font-semibold text-slate-900">{row.bottlesInStockBefore ?? '-'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock After Tasting</p>
                        <p className="text-lg font-semibold text-slate-900">{row.bottlesInStockAfter ?? '-'}</p>
                      </div>
                    </div>
                    {row.actualStartTime || row.actualEndTime ? (
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual Times</p>
                        <p className="text-sm text-slate-900">{row.actualStartTime ?? '?'} - {row.actualEndTime ?? '?'}</p>
                      </div>
                    ) : null}
                    {[
                      { label: 'Account Feedback', value: row.accountFeedback },
                      { label: 'Highlights', value: row.highlights },
                      { label: 'Issues / Constraints', value: row.issues },
                    ].map(({ label, value }) =>
                      value ? (
                        <div key={label} className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="text-sm text-slate-900">{value}</p>
                        </div>
                      ) : null
                    )}

                    {(row.setupPhotoUrl || (row.shelfPhotoUrls && row.shelfPhotoUrls.length > 0)) && (
                      <div className="space-y-1.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Captured Photos</p>
                        <DeliveryPhotoGallery photos={getTastingGalleryPhotos(row)} thumbnailVariant="compact" />
                      </div>
                    )}

                    {row.followUpNeeded && (
                      <div className="space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Follow-up Required</p>
                        {row.followUpNotes && <p className="text-sm text-amber-900">{row.followUpNotes}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground">
                    No report submitted yet.
                  </div>
                )}

                {row.reportId && (
                  <TastingInsightsCard
                    tastingId={row.tastingId}
                    existingAnalysis={analysesMap[row.tastingId] ?? null}
                  />
                )}

                {row.invoiceId && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Invoice · {row.payeeName} · submitted {formatEasternDateTime(row.invoiceSubmittedAt!)}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hours x Rate</p>
                        <p className="text-sm text-slate-900">{Number(row.hoursWorked ?? 0).toFixed(2)} hrs @ {formatCurrency(Number(row.hourlyRate ?? 0))}/hr</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Other Expenses</p>
                        <p className="text-sm text-slate-900">{formatCurrency(Number(row.expenseAmount ?? 0))}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Due</p>
                        <p className="text-base font-semibold text-slate-900">{formatCurrency(Number(row.totalAmount ?? 0))}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
