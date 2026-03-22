import { TasterSignupForm } from '@/components/marketing/TasterSignupForm'
import Link from 'next/link'
import Image from 'next/image'
import { Wine, ClipboardList, DollarSign, CalendarCheck } from 'lucide-react'

export const metadata = {
  title: 'Join as a Taster - AHAWC',
  description: 'Create your AHAWC taster account to receive tasting assignments, submit reports, and track your payouts.',
}

const BENEFITS = [
  {
    icon: CalendarCheck,
    title: 'Tasting assignments',
    description: 'Receive and confirm in-store tasting bookings directly from the portal.',
  },
  {
    icon: Wine,
    title: 'Product resources',
    description: 'Access brand sheets, talking points, and bottle specs for every tasting.',
  },
  {
    icon: ClipboardList,
    title: 'Digital reports',
    description: 'Submit bottle counts and tasting notes straight from your phone.',
  },
  {
    icon: DollarSign,
    title: 'Payout tracking',
    description: 'See completed events and track your earnings in one place.',
  },
]

export default function TasterSignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
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
          <Link href="/login" className="text-sm text-blue-300 transition-colors hover:text-white">
            Already have a taster account?{' '}
            <span className="font-medium underline underline-offset-2">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
                Taster Sign Up
              </p>
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
                Create your AHAWC<br />taster account
              </h1>
              <p className="text-lg leading-relaxed text-slate-300">
                This page is for AHAWC tasters and brand ambassadors. Create your taster portal account to accept tasting assignments, submit reports, and track payouts in one place.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-blue-400" />
                    <p className="text-sm font-semibold text-white">{title}</p>
                  </div>
                  <p className="text-sm text-slate-400">{description}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              Questions? Email us at{' '}
              <a
                href="mailto:tastings@ahawc.com"
                className="text-slate-400 underline underline-offset-2 hover:text-white"
              >
                tastings@ahawc.com
              </a>
            </p>
          </div>

          <div className="lg:sticky lg:top-8">
            <TasterSignupForm />
          </div>
        </div>
      </main>
    </div>
  )
}
