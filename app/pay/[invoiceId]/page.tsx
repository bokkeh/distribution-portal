import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { createPublicPaymentIntent } from '@/actions/invoices'
import InvoicePaymentClient from '@/components/invoices/InvoicePaymentClient'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { resolveInvoiceIdFromPublicToken } from '@/lib/invoices/public-token'

export default async function PublicPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId: token } = await params
  const resolvedInvoiceId = resolveInvoiceIdFromPublicToken(token)
  if (!resolvedInvoiceId) notFound()

  const invoice = await getInvoiceDetailData(resolvedInvoiceId)
  if (!invoice) notFound()

  const isPaid = invoice.status === 'paid'
  const isPayable = invoice.status === 'sent' || invoice.status === 'overdue'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.38),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(254,215,170,0.28),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#f4f7fb_100%)] px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
            <Image src="/brand/logo.png" alt="AHAWC" fill className="object-contain p-1" unoptimized />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AHAWC</p>
            <p className="text-xs text-muted-foreground">Secure invoice payment</p>
          </div>
        </div>

        <InvoiceVisual invoice={invoice} />

        {isPaid ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <Badge variant="success" className="mb-2 px-3 py-1 text-sm">Paid</Badge>
            <p className="text-sm text-emerald-800">This invoice has already been paid. Thank you!</p>
          </div>
        ) : !isPayable ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
            <Badge variant="warning" className="mb-2 px-3 py-1 text-sm">{invoice.status}</Badge>
            <p className="text-sm text-amber-800">This invoice is not currently open for payment from the public link.</p>
          </div>
        ) : (
          <InvoicePaymentClient
            invoiceId={token}
            total={String(invoice.total)}
            returnUrl={`/pay/${token}/success`}
            paymentIntentAction={createPublicPaymentIntent}
            waiveAchFee={invoice.waiveAchFee}
          />
        )}

        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely via Stripe. AHAWC will never store your card details.
        </p>
      </div>
    </div>
  )
}
