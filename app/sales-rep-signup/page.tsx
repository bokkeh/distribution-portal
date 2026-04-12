import Image from 'next/image'
import Link from 'next/link'
import { BriefcaseBusiness, ChartNoAxesColumn, MapPinned, ReceiptText } from 'lucide-react'
import { getSalesRepInviteByToken } from '@/actions/sales-rep-invites'
import { SalesRepInviteSignupForm } from '@/components/marketing/SalesRepInviteSignupForm'

export const metadata = {
  title: 'Join as a Sales Rep - AHAWC',
  description: 'Create your AHAWC sales rep account from your private invite link.',
}

const BENEFITS = [
  {
    icon: BriefcaseBusiness,
    title: 'Assigned accounts',
    description: 'See your book of business and keep account details up to date from the field.',
  },
  {
    icon: MapPinned,
    title: 'Routes and visits',
    description: 'Plan store visits, manage routes, and track follow-ups in one portal.',
  },
  {
    icon: ChartNoAxesColumn,
    title: 'Sales pipeline',
    description: 'Track activity, opportunities, and account momentum across your territory.',
  },
  {
    icon: ReceiptText,
    title: 'Commissions and forecasting',
    description: 'Review commissions, forecasts, and order performance in the sales workspace.',
  },
]

export default async function SalesRepSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  const invite = token ? await getSalesRepInviteByToken(token) : null
  const inviteValid = Boolean(invite && invite.status === 'pending' && invite.expiresAt.getTime() >= Date.now())

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
            Already have an account?{' '}
            <span className="font-medium underline underline-offset-2">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
                Sales Rep Invite
              </p>
              <h1 className="text-4xl font-bold leading-tight text-slate-500 sm:text-5xl">
                Create your AHAWC<br />sales rep account
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                Use your invite link to finish setting up access to the AHAWC sales portal. Your account will be configured as a sales rep automatically.
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
              Need a new invite? Contact your AHAWC admin or sales manager.
            </p>
          </div>

          <div className="lg:sticky lg:top-8">
            {inviteValid && invite ? (
              <SalesRepInviteSignupForm
                token={token}
                defaultEmail={invite.email}
                defaultName={invite.name}
                defaultPhone={invite.phone}
              />
            ) : (
              <div className="space-y-4 rounded-3xl border border-red-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Invite Required</p>
                <h2 className="text-xl font-bold text-slate-900">This sales rep invite is not valid</h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  The link may be missing, expired, or already used. Ask an admin to send you a fresh invite.
                </p>
                <Link href="/login" className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                  Go to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
