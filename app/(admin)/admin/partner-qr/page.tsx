import { requireRole } from '@/lib/auth/session'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Partner Sign-Up QR Code' }

export default async function PartnerQRPage() {
  await requireRole('admin', 'staff')

  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'
  const proto = headerStore.get('x-forwarded-proto') ?? 'https'
  const baseUrl = process.env.NEXTAUTH_URL ?? `${proto}://${host}`
  const partnerUrl = `${baseUrl}/partner`

  const qrImageUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=M&margin=2&data=${encodeURIComponent(partnerUrl)}`

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Nav */}
      <div className="p-4 sm:p-6">
        <Link
          href="/admin/crm"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
      </div>

      {/* Main display — centred, big, easy to show on a phone */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-12 text-center">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Partner Onboarding</p>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Scan to create an account</h1>
          <p className="max-w-sm text-slate-500">
            Hand this screen to your contact. They scan the QR code, fill out their business info, and land straight in the product catalog.
          </p>
        </div>

        {/* QR code */}
        <div className="rounded-3xl border-4 border-slate-900 bg-white p-4 shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl}
            alt="Partner sign-up QR code"
            width={320}
            height={320}
            className="block rounded-xl"
          />
        </div>

        {/* URL fallback */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Or type this address</p>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="select-all font-mono text-sm font-semibold text-slate-900">{partnerUrl}</span>
            <Link
              href={partnerUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-slate-400 hover:text-blue-600"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <p className="max-w-xs text-xs text-slate-400">
          New accounts are active immediately. The partner lands directly on the product catalog after signing up.
        </p>
      </div>
    </div>
  )
}
