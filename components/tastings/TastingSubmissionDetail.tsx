'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { submitTasterInvoice, submitTastingReport } from '@/actions/tastings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
            <p className="font-medium text-slate-900">{format(new Date(tasting.scheduledAt), 'EEEE, MMM d yyyy h:mm a')}</p>
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
        <Card id="report">
          <CardHeader>
            <CardTitle>Submit Tasting Report</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitTastingReport} className="space-y-4">
              <input type="hidden" name="tastingId" value={tasting.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="actualStartTime">Actual Start Time</Label>
                  <Input id="actualStartTime" name="actualStartTime" type="time" defaultValue={report?.actualStartTime ?? format(new Date(tasting.scheduledAt), 'HH:mm')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actualEndTime">Actual End Time</Label>
                  <Input id="actualEndTime" name="actualEndTime" type="time" defaultValue={report?.actualEndTime ?? ''} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="samplesServed">Samples Served</Label>
                  <Input id="samplesServed" name="samplesServed" type="number" min="0" defaultValue={report?.samplesServed ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consumerInteractions">Consumer Interactions</Label>
                  <Input id="consumerInteractions" name="consumerInteractions" type="number" min="0" defaultValue={report?.consumerInteractions ?? 0} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bottlesSold">Bottles Sold</Label>
                  <Input id="bottlesSold" name="bottlesSold" type="number" min="0" defaultValue={report?.bottlesSold ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="casesSold">Cases Sold</Label>
                  <Input id="casesSold" name="casesSold" type="number" min="0" defaultValue={report?.casesSold ?? 0} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountFeedback">Store Feedback</Label>
                <textarea id="accountFeedback" name="accountFeedback" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.accountFeedback ?? ''} placeholder="What did the store team say? Any requests or notable comments?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="highlights">What Went Well</Label>
                <textarea id="highlights" name="highlights" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.highlights ?? ''} placeholder="Quick summary of the tasting, top moments, and what moved product." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issues">Issues Or Constraints</Label>
                <textarea id="issues" name="issues" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.issues ?? ''} placeholder="Any supply issues, staffing issues, or problems during the event." />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="followUpNeeded" defaultChecked={report?.followUpNeeded ?? false} className="rounded" />
                  Follow-up needed from staff
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpNotes">Follow-up Notes</Label>
                <textarea id="followUpNotes" name="followUpNotes" className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.followUpNotes ?? ''} placeholder="List anything staff needs to action after this tasting." />
              </div>

              <Button type="submit" className="w-full">{report ? 'Update Report' : 'Submit Report'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card id="invoice">
          <CardHeader>
            <CardTitle>Submit Invoice To Accounting</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitTasterInvoice} className="space-y-4">
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
                  Submitted {format(new Date(invoice.submittedAt), 'MMM d, yyyy h:mm a')} • Status: <span className="font-medium text-slate-900">{invoice.status}</span>
                </div>
              ) : null}

              <Button type="submit" className="w-full">{invoice ? 'Update Invoice' : 'Submit Invoice'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
