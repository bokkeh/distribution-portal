'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { submitTasterInvoice } from '@/actions/tastings'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { formatCurrency } from '@/lib/utils'
import { TasterInvoiceReceiptField } from './TasterInvoiceReceiptField'
import { TastingReportFormCard } from './TastingReportFormCard'

type ReportRecord = {
  actualStartTime: string | null
  actualEndTime: string | null
  samplesServed: number | null
  bottlesSold: number | null
  missedCustomers: number | null
  consumerInteractions: number | null
  bottlePriceOnShelf: string | null
  bottlesInStock: number | null
  accountFeedback: string | null
  highlights: string | null
  issues: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  setupPhotoUrl: string | null
  shelfPhotoUrls: string[] | null
  submittedAt: Date | null
} | null

type InvoiceRecord = {
  payeeName: string
  payeeEmail: string
  payeePhone: string | null
  hourlyRate: string
  hoursWorked: string
  expenseAmount: string
  totalAmount: string
  receiptUrls: string[] | null
  notes: string | null
  status: string
  submittedAt: Date | null
} | null

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return (hours * 60) + minutes
}

function getDefaultHoursWorked(report: ReportRecord, invoice: InvoiceRecord) {
  if (invoice?.hoursWorked) return invoice.hoursWorked

  const startMinutes = parseTimeToMinutes(report?.actualStartTime)
  const endMinutes = parseTimeToMinutes(report?.actualEndTime)
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    return '2.00'
  }

  const roundedQuarterHours = Math.round((endMinutes - startMinutes) / 15) / 4
  return Math.max(0.25, roundedQuarterHours).toFixed(2)
}

export function TastingSubmissionDetail({
  tasting,
  report,
  invoice,
  user,
  adminHourlyRate,
  success,
  error,
  reportMode = 'default',
  invoiceMode = 'default',
  reportBlankHref,
  reportStandardHref,
  invoiceBlankHref,
  invoiceStandardHref,
}: {
  tasting: {
    id: string
    eventName: string
    scheduledAt: Date
    status: string
    storeAddress: string | null
    storeCity: string | null
    storeState: string | null
    storeZip: string | null
    storePhone: string | null
    notes: string | null
  }
  report: ReportRecord
  invoice: InvoiceRecord
  user: {
    name: string | null | undefined
    email: string | null | undefined
    phone: string | null | undefined
  }
  adminHourlyRate?: string | null
  success?: string
  error?: string
  reportMode?: 'default' | 'manual'
  invoiceMode?: 'default' | 'manual'
  reportBlankHref?: string
  reportStandardHref?: string
  invoiceBlankHref?: string
  invoiceStandardHref?: string
}) {
  const invoiceLocked = invoice?.status === 'approved' || invoice?.status === 'paid'
  const usingManualInvoice = invoiceMode === 'manual'
  const activeInvoice = usingManualInvoice ? null : invoice
  const defaultHoursWorked = useMemo(() => {
    if (usingManualInvoice) return ''
    return getDefaultHoursWorked(report, activeInvoice)
  }, [activeInvoice, report, usingManualInvoice])
  const defaultExpenseAmount = activeInvoice?.expenseAmount ?? (usingManualInvoice ? '' : '0.00')
  const [hoursWorked, setHoursWorked] = useState(() => activeInvoice?.hoursWorked ?? defaultHoursWorked)
  const [expenseAmount, setExpenseAmount] = useState(() => defaultExpenseAmount)
  const totalEstimate = useMemo(() => {
    const rate = Number(adminHourlyRate ?? invoice?.hourlyRate ?? '25')
    const hours = Number(hoursWorked || '0')
    const expenses = Number(expenseAmount || '0')
    return (rate * hours) + expenses
  }, [adminHourlyRate, expenseAmount, hoursWorked, invoice?.hourlyRate])

  const invoiceFormRef = useRef<HTMLFormElement | null>(null)
  const invoiceDraft = useFormDraftAutosave(
    invoiceFormRef,
    usingManualInvoice ? `tasting-invoice:${tasting.id}:manual` : `tasting-invoice:${tasting.id}`,
  )

  useEffect(() => {
    if (success === 'Invoice submitted to accounting.') invoiceDraft.clearDraft()
  }, [invoiceDraft, success])

  return (
    <div className="space-y-6">
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>{tasting.eventName}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Assigned time</p>
            <p className="font-medium text-slate-900">{formatEasternDateTime(tasting.scheduledAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <Badge variant="secondary">{tasting.status}</Badge>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Store location</p>
            <p className="font-medium text-slate-900">{[tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'No address on file'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Store phone</p>
            <p className="font-medium text-slate-900">{tasting.storePhone ?? 'No store phone on file'}</p>
          </div>
          {tasting.notes ? (
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Assignment notes</p>
              <p className="font-medium text-slate-900">{tasting.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <TastingReportFormCard
          key={`${tasting.id}:${reportMode}`}
          tasting={tasting}
          report={report}
          reportMode={reportMode}
          startFromScratchHref={reportBlankHref}
          standardHref={reportStandardHref}
        />

        <Card id="invoice">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Submit Invoice To Accounting</CardTitle>
            <div className="flex flex-wrap gap-2">
              {usingManualInvoice && invoiceStandardHref ? (
                <Link href={invoiceStandardHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Use Standard Form
                </Link>
              ) : null}
              {!usingManualInvoice && invoiceBlankHref && !invoiceLocked ? (
                <Link href={invoiceBlankHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Start From Scratch
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {usingManualInvoice ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {invoice
                  ? 'You are using a blank backup invoice form. Saving it will replace the current invoice values.'
                  : 'You are using a blank backup invoice form with no automatic prefills.'}
              </div>
            ) : null}
            <form
              key={`${invoiceMode}:${invoice?.submittedAt?.toISOString() ?? 'new'}`}
              ref={invoiceFormRef}
              action={submitTasterInvoice}
              className="space-y-4"
            >
              <input type="hidden" name="tastingId" value={tasting.id} />
              <fieldset disabled={invoiceLocked} className="space-y-4 disabled:opacity-70">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payeeName">Payee Name</Label>
                  <Input id="payeeName" name="payeeName" defaultValue={activeInvoice?.payeeName ?? user.name ?? ''} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payeeEmail">Payee Email</Label>
                  <Input id="payeeEmail" name="payeeEmail" type="email" defaultValue={activeInvoice?.payeeEmail ?? user.email ?? ''} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payeePhone">Payee Phone</Label>
                <Input id="payeePhone" name="payeePhone" type="tel" defaultValue={activeInvoice?.payeePhone ?? user.phone ?? ''} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hoursWorked">Hours Worked</Label>
                <Input
                  id="hoursWorked"
                  name="hoursWorked"
                  type="number"
                  step="0.25"
                  min="0"
                  value={hoursWorked}
                  onChange={(event) => setHoursWorked(event.target.value)}
                  required
                />
                <p className="text-xs text-slate-500">
                  Adjust this to match the actual shift length. {usingManualInvoice ? 'Manual mode starts blank.' : report?.actualStartTime && report?.actualEndTime ? 'Prefilled from your report times.' : 'Use 15-minute increments if possible.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expenseAmount">Other Expenses ($)</Label>
                <Input
                  id="expenseAmount"
                  name="expenseAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                />
              </div>

              <TasterInvoiceReceiptField value={activeInvoice?.receiptUrls ?? []} disabled={invoiceLocked} />

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Estimated total: </span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(invoiceLocked ? invoice?.totalAmount ?? totalEstimate : totalEstimate)}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  ({formatCurrency(adminHourlyRate ?? invoice?.hourlyRate ?? '25')}/hr + expenses)
                </span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Invoice Notes</Label>
                <textarea id="notes" name="notes" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={activeInvoice?.notes ?? ''} placeholder="Anything accounting should know about this payment." />
              </div>
              </fieldset>

              {invoice ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Submitted {invoice.submittedAt ? formatEasternDateTime(invoice.submittedAt) : 'date unavailable'} • Status: <span className="font-medium text-slate-900">{invoice.status}</span>
                </div>
              ) : null}

              {!report ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Submit the event report before sending an invoice to accounting.
                </div>
              ) : null}
              {report && tasting.status !== 'completed' ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Sending this invoice will also mark the tasting completed.
                </div>
              ) : null}
              {invoiceLocked ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  This invoice is locked because it has already been {invoice?.status}.
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-500">{invoiceDraft.statusText || 'Invoice draft saves locally while you type.'}</span>
                <span className="text-slate-500">
                  {invoice ? `Status: ${invoice.status}` : usingManualInvoice ? 'Blank manual form' : 'Draft mode'}
                </span>
              </div>

              <Button type="submit" className="w-full" disabled={invoiceLocked}>
                {invoice ? (usingManualInvoice ? 'Replace Invoice' : 'Update Invoice') : 'Submit Invoice'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
