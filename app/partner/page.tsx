import Image from 'next/image'
import Link from 'next/link'
import { PartnerSignupForm } from '@/components/auth/PartnerSignupForm'
import { Package, TrendingUp, Users, CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'Partner Sign Up – AHAWC',
  description: 'Create your wholesale account and start ordering today.',
}

const BENEFITS = [
  { icon: Package, title: 'Order online, 24/7', description: 'Browse products and place orders any time from any device.' },
  { icon: TrendingUp, title: 'Wholesale pricing', description: 'Tiered pricing and payment terms tailored to your business.' },
  { icon: Users, title: 'Dedicated support', description: 'A direct line to your account rep for orders and questions.' },
  { icon: CheckCircle2, title: 'Digital invoicing', description: 'All your invoices in one place — no more paper chasing.' },
]

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.65),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(254,215,170,0.5),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_52%,_#fffaf5_100%)]">
      <header className="border-b border-slate-200/80 bg-white/75 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shadow-sm"
            />
            <span className="text-sm font-bold tracking-wide text-slate-900">AHAWC</span>
          </div>
          <Link href="/login" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
            Already a partner?{' '}
            <span className="font-medium underline underline-offset-2">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          {/* Left: pitch */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Wholesale Partner Portal</p>
              <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                Start ordering<br />in minutes
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-slate-600">
                Create your account now and go straight to browsing our full product catalog. No waiting for approval.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="space-y-1.5 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
                >
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-100 p-1.5 text-blue-700">
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                  </div>
                  <p className="text-sm text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur lg:sticky lg:top-8">
            <h2 className="mb-6 text-xl font-bold text-slate-900">Create your account</h2>
            <PartnerSignupForm />
          </div>
        </div>
      </main>
    </div>
  )
}
