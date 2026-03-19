import { notFound } from 'next/navigation'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import InvoicePaymentClient from '@/components/invoices/InvoicePaymentClient'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

export default async function PublicPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params
  const invoice = await getInvoiceDetailData(invoiceId)

  if (!invoice) notFound()

  const isPaid = invoice.status === 'paid'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-white shrink-0">
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
        ) : (
          <InvoicePaymentClient
            invoiceId={invoice.id}
            total={String(invoice.total)}
            returnUrl={`/pay/${invoiceId}/success`}
          />
        )}

        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely via Stripe. AHAWC will never store your card details.
        </p>
      </div>
    </div>
  )
}
