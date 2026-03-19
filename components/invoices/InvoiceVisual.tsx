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
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
}

export function InvoiceVisual({ invoice }: { invoice: InvoiceDetailData }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-950 px-6 py-8 text-white sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white shrink-0">
                <Image src="/brand/logo.png" alt="AHAWC" fill className="object-contain p-1" unoptimized />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">AHAWC Distribution</p>
            </div>
            <h2 className="text-3xl font-bold">Invoice</h2>
            <p className="mt-2 max-w-md text-sm text-slate-300">
              Premium distribution billing statement for products, tasting support, and related account charges.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
            <div className="flex items-center justify-between gap-6">
              <span className="text-slate-300">Invoice #</span>
              <span className="font-semibold text-white">{invoice.invoiceNumber}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-6">
              <span className="text-slate-300">Issue date</span>
              <span>{formatDate(invoice.createdAt)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-6">
              <span className="text-slate-300">Due date</span>
              <span>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bill To</p>
          <p className="mt-3 text-lg font-semibold text-slate-950">{invoice.companyName}</p>
          {invoice.customerAddressLines.map((line) => (
            <p key={line} className="mt-1 text-sm text-slate-600">{line}</p>
          ))}
          {invoice.customerEmail ? <p className="mt-3 text-sm text-slate-600">{invoice.customerEmail}</p> : null}
          {invoice.customerPhone ? <p className="mt-1 text-sm text-slate-600">{invoice.customerPhone}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[invoice.status] ?? statusStyles.draft}`}>
              {invoice.status}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Terms</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatPaymentTerms(invoice.paymentTerms)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Linked Order</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{invoice.orderId ? invoice.orderId.slice(-8).toUpperCase() : 'Direct invoice'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
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
                  <td className="px-4 py-4 text-sm text-slate-500">{item.sku ?? '—'}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-6 sm:px-8">
        <div className="ml-auto max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-900">{formatCurrency(invoice.amount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Tax</span>
            <span className="font-medium text-slate-900">{formatCurrency(invoice.tax)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold">
            <span className="text-slate-900">Total</span>
            <span className="text-blue-700">{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
