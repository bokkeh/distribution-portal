import Image from 'next/image'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { InvoiceDetailData } from '@/lib/invoices/read'

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  PREPAID: 'Prepaid',
  DUE_ON_RECEIPT: 'Due on Receipt',
  NET7: 'Net 7',
  NET10: 'Net 10',
  NET15: 'Net 15',
  NET30: 'Net 30',
  NET45: 'Net 45',
  NET60: 'Net 60',
  NET90: 'Net 90',
  COD: 'COD',
  '2/10_NET30': '2/10 Net 30',
}

function formatPaymentTerms(terms: string | null): string {
  if (!terms) return 'Net 30'
  return PAYMENT_TERMS_LABELS[terms] ?? terms
}

const statusStyles: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-700',
  sent: 'border-sky-200 bg-sky-50 text-sky-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
}

export function InvoiceVisual({ invoice }: { invoice: InvoiceDetailData }) {
  const appliedMethodLabel = invoice.stripeCheckout.appliedMethodLabel
  const appliedProcessingFee = invoice.stripeCheckout.appliedProcessingFee
  const appliedTotal = invoice.stripeCheckout.appliedTotal
  const hasAppliedStripeFee = (
    invoice.stripeCheckout.appliedMethod !== null &&
    appliedMethodLabel !== null &&
    appliedProcessingFee !== null &&
    appliedTotal !== null
  )
  const totalDisplay = hasAppliedStripeFee ? appliedTotal : invoice.total
  // One-off: hide the Stripe checkout fee breakdown on this invoice (flat $150, paid by check).
  const hideStripeCheckoutBreakdown = invoice.id === '02baa673-e68d-4332-a8a0-7cf4ea9aa591'
  const dueDateDisplay = invoice.isPrepaidSettled
    ? 'Paid already'
    : invoice.dueDate
      ? formatDate(invoice.dueDate)
      : '-'

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))] shadow-[0_24px_70px_-40px_rgba(15,23,42,0.32)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_62%,_#fdf8f3_100%)] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Image src="/brand/logo.png" alt="AHAWC" fill className="object-contain p-1" unoptimized />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">AHAWC Distribution</p>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Invoice</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Premium distribution billing statement for products, tasting support, and related account charges.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 text-sm shadow-sm sm:min-w-[250px]">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-4 gap-y-3">
              <span className="text-slate-500">Invoice #</span>
              <span className="break-words text-right font-semibold text-slate-900">{invoice.invoiceNumber}</span>

              <span className="text-slate-500">Issue date</span>
              <span className="text-right text-slate-900">{formatDate(invoice.createdAt)}</span>

              <span className="text-slate-500">Due date</span>
              <span className="text-right text-slate-900">{dueDateDisplay}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.4)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bill To</p>
          <p className="mt-3 text-lg font-semibold text-slate-950">{invoice.companyName}</p>
          {invoice.customerAddressLines.map((line) => (
            <p key={line} className="mt-1 text-sm text-slate-600">{line}</p>
          ))}
          {invoice.customerEmail ? <p className="mt-3 text-sm text-slate-600">{invoice.customerEmail}</p> : null}
          {invoice.customerPhone ? <p className="mt-1 text-sm text-slate-600">{invoice.customerPhone}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.4)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[invoice.status] ?? statusStyles.draft}`}>
              {invoice.status}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Terms</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatPaymentTerms(invoice.paymentTerms)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Linked Order</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {invoice.orderId ? invoice.orderId.slice(-8).toUpperCase() : 'Direct invoice'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-28px_rgba(15,23,42,0.32)]">
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-sm font-medium text-slate-900">{item.description}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">{item.sku ?? '-'}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-6 sm:px-8">
        <div className="ml-auto max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.32)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-900">{formatCurrency(invoice.amount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Tax</span>
            <span className="font-medium text-slate-900">{formatCurrency(invoice.tax)}</span>
          </div>
          {hasAppliedStripeFee ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{appliedMethodLabel} fee</span>
              <span className="font-medium text-slate-900">{formatCurrency(appliedProcessingFee)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold">
            <span className="text-slate-900">Total</span>
            <span className="text-blue-700">{formatCurrency(totalDisplay)}</span>
          </div>
          {hasAppliedStripeFee ? (
            <p className="border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">
              Total reflects the Stripe {appliedMethodLabel.toLowerCase()} checkout amount.
            </p>
          ) : hideStripeCheckoutBreakdown ? null : (
            <div className="border-t border-dashed border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe Checkout Totals</p>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ACH total</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.stripeCheckout.achTotal)}</span>
                </div>
                <p className="text-xs text-slate-500">Includes {formatCurrency(invoice.stripeCheckout.achFee)} ACH fee.</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Card total</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.stripeCheckout.cardTotal)}</span>
                </div>
                <p className="text-xs text-slate-500">Includes {formatCurrency(invoice.stripeCheckout.cardFee)} credit card fee.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
