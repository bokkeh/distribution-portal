import { JoinRequestForm } from '@/components/marketing/JoinRequestForm'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Package, TrendingUp, Users } from 'lucide-react'

export const metadata = {
  title: 'Request Wholesale Access - AHAWC Distribution Portal',
  description: 'Apply for a wholesale account with AHAWC and access exclusive distributor pricing, real-time order tracking, and dedicated account support.',
}

const BENEFITS = [
  {
    icon: Package,
    title: 'Real-time order tracking',
    description: 'Track every delivery from placement to your door.',
  },
  {
    icon: TrendingUp,
    title: 'Exclusive wholesale pricing',
    description: 'Access tiered pricing and payment terms tailored to your business.',
  },
  {
    icon: Users,
    title: 'Dedicated account support',
    description: 'Your own point of contact for orders, invoices, and questions.',
  },
  {
    icon: CheckCircle2,
    title: 'Digital invoicing',
    description: 'Receive and manage invoices online - no more paper chasing.',
  },
]

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.65),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(254,215,170,0.5),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_52%,_#fffaf5_100%)]">
      <header className="border-b border-slate-200/80 bg-white/75 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
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
            Already have an account? <span className="font-medium underline underline-offset-2">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Wholesale Partner Portal</p>
              <h1 className="text-4xl font-bold leading-tight text-slate-500 sm:text-5xl">
                Apply for a
                <br />
                wholesale account
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                AHAWC partners with restaurants, liquor stores, hotel groups, and hospitality businesses across the region. Fill out the form and our team will review your application within 1-2 business days.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur"
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

            <p className="text-xs text-slate-500">
              By submitting this form you agree to our{' '}
              <Link href="/privacy" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
                Terms &amp; Conditions
              </Link>
              .
            </p>
          </div>

          <div className="lg:sticky lg:top-8">
            <JoinRequestForm />
          </div>
        </div>
      </main>
    </div>
  )
}
