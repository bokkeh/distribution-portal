'use client'

import { useEffect, useMemo, useRef } from 'react'
import { submitTasterInvoice } from '@/actions/tastings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { TastingReportFormCard } from './TastingReportFormCard'

type ReportRecord = {
  actualStartTime: string | null
  actualEndTime: string | null
  samplesServed: number | null
  bottlesSold: number | null
  casesSold: number | null
  consumerInteractions: number | null
  accountFeedback: string | null
  highlights: string | null
  issues: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  submittedAt: Date
} | null

type InvoiceRecord = {
  payeeName: string
  payeeEmail: string
  payeePhone: string | null
  hourlyRate: string
  hoursWorked: string
  mileage: string
  expenseAmount: string
  totalAmount: string
  notes: string | null
  status: string
  submittedAt: Date
} | null

export function TastingSubmissionDetail({
  tasting,
  report,
  invoice,
  user,
  success,
  error,
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
  success?: string
  error?: string
}) {
  const totalEstimate = useMemo(() => {
    const rate = Number(invoice?.hourlyRate ?? '25')
    const hours = Number(invoice?.hoursWorked ?? '2')
    const mileage = Number(invoice?.mileage ?? '0')
    const expenses = Number(invoice?.expenseAmount ?? '0')
    return (rate * hours) + mileage + expenses
  }, [invoice?.expenseAmount, invoice?.hourlyRate, invoice?.hoursWorked, invoice?.mileage])

  const invoiceFormRef = useRef<HTMLFormElement | null>(null)
  const invoiceDraft = useFormDraftAutosave(invoiceFormRef, `tasting-invoice:${tasting.id}`)

  useEffect(() => {
    if (success === 'invoice_submitted') invoiceDraft.clearDraft()
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
        <TastingReportFormCard tasting={tasting} report={report} />

        <Card id="invoice">
          <CardHeader>
            <CardTitle>Submit Invoice To Accounting</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={invoiceFormRef} action={submitTasterInvoice} className="space-y-4">
              <input type="hidden" name="tastingId" value={tasting.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payeeName">Payee Name</Label>
                  <Input id="payeeName" name="payeeName" defaultValue={invoice?.payeeName ?? user.name ?? ''} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payeeEmail">Payee Email</Label>
                  <Input id="payeeEmail" name="payeeEmail" type="email" defaultValue={invoice?.payeeEmail ?? user.email ?? ''} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payeePhone">Payee Phone</Label>
                <Input id="payeePhone" name="payeePhone" type="tel" defaultValue={invoice?.payeePhone ?? user.phone ?? ''} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Hourly Rate</Label>
                  <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" min="0" defaultValue={invoice?.hourlyRate ?? '25.00'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hoursWorked">Hours Worked</Label>
                  <Input id="hoursWorked" name="hoursWorked" type="number" step="0.25" min="0" defaultValue={invoice?.hoursWorked ?? '2.00'} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mileage">Mileage / Travel</Label>
                  <Input id="mileage" name="mileage" type="number" step="0.01" min="0" defaultValue={invoice?.mileage ?? '0.00'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expenseAmount">Other Expenses</Label>
                  <Input id="expenseAmount" name="expenseAmount" type="number" step="0.01" min="0" defaultValue={invoice?.expenseAmount ?? '0.00'} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Invoice Amount</Label>
                <Input id="totalAmount" name="totalAmount" type="number" step="0.01" min="0" defaultValue={invoice?.totalAmount ?? totalEstimate.toFixed(2)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Invoice Notes</Label>
                <textarea id="notes" name="notes" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={invoice?.notes ?? ''} placeholder="Anything accounting should know about this payment." />
              </div>

              {invoice ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Submitted {formatEasternDateTime(invoice.submittedAt)} • Status: <span className="font-medium text-slate-900">{invoice.status}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-500">{invoiceDraft.statusText || 'Invoice draft saves locally while you type.'}</span>
                <span className="text-slate-500">{invoice ? `Status: ${invoice.status}` : 'Draft mode'}</span>
              </div>

              <Button type="submit" className="w-full">{invoice ? 'Update Invoice' : 'Submit Invoice'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
