import Image from 'next/image'
import Link from 'next/link'
import { getTasterInviteByToken } from '@/actions/taster-invites'
import { TasterInviteAcceptForm } from '@/components/marketing/TasterInviteAcceptForm'

export const metadata = {
  title: 'Activate Your Taster Account - AHAWC',
  description: 'Set your password to activate your AHAWC taster account.',
}

export default async function TasterInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = token ? await getTasterInviteByToken(token) : null
  const inviteValid = Boolean(invite && invite.status === 'pending' && invite.expiresAt.getTime() >= Date.now())

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.65),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(254,215,170,0.5),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_52%,_#fffaf5_100%)]">
      <header className="border-b border-slate-200/80 bg-white/75 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
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
            Already active?{' '}
            <span className="font-medium underline underline-offset-2">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-16 sm:py-24">
        {inviteValid && invite ? (
          <TasterInviteAcceptForm token={token} email={invite.email} />
        ) : (
          <div className="space-y-4 rounded-3xl border border-red-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Invite Required</p>
            <h2 className="text-xl font-bold text-slate-900">This invite link is not valid</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              The link may be missing, expired, or already used. Ask an admin to resend your invitation.
            </p>
            <Link href="/login" className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
              Go to sign in
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
