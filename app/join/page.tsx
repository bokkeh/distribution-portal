import { JoinRequestForm } from '@/components/marketing/JoinRequestForm'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Package, TrendingUp, Users } from 'lucide-react'

export const metadata = {
  title: 'Request Wholesale Access — AHAWC Distribution Portal',
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
    description: 'Receive and manage invoices online — no more paper chasing.',
  },
]

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg bg-white object-contain p-0.5"
            />
            <span className="text-sm font-bold tracking-wide text-white">AHAWC</span>
          </div>
          <Link href="/login" className="text-sm text-blue-300 hover:text-white transition-colors">
            Already have an account? <span className="font-medium underline underline-offset-2">Sign in</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start">
          {/* Left: copy */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Wholesale Partner Portal</p>
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
                Apply for a<br />wholesale account
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed">
                AHAWC partners with restaurants, liquor stores, hotel groups, and hospitality businesses across the region. Fill out the form and our team will review your application within 1–2 business days.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-blue-400 shrink-0" />
                    <p className="text-sm font-semibold text-white">{title}</p>
                  </div>
                  <p className="text-sm text-slate-400">{description}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              By submitting this form you agree to our{' '}
              <Link href="/privacy" className="text-slate-400 underline underline-offset-2 hover:text-white">Privacy Policy</Link>
              {' '}and{' '}
              <Link href="/terms" className="text-slate-400 underline underline-offset-2 hover:text-white">Terms &amp; Conditions</Link>.
            </p>
          </div>

          {/* Right: form */}
          <div className="lg:sticky lg:top-8">
            <JoinRequestForm />
          </div>
        </div>
      </main>
    </div>
  )
}
