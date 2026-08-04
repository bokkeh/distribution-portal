import Image from 'next/image'
import Link from 'next/link'
import { getCustomerPortalInviteByToken } from '@/actions/customer-portal-invites'
import { CustomerPortalActivationForm } from '@/components/marketing/CustomerPortalActivationForm'

export const metadata = {
  title: 'Activate Customer Portal - AHAWC',
  description: 'Set your password for an approved AHAWC customer account.',
}

export default async function CustomerActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  const invite = token ? await getCustomerPortalInviteByToken(token) : null
  const valid = Boolean(invite?.isValid)

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50 px-6 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Image src="/brand/logo.png" alt="AHAWC" width={36} height={36} className="rounded-lg border border-slate-200 bg-white" />
          <span className="font-bold tracking-wide text-slate-900">AHAWC</span>
        </div>
        {valid && invite ? (
          <CustomerPortalActivationForm
            token={token}
            email={invite.email}
            businessName={invite.businessName}
            defaultName={invite.contactName}
          />
        ) : (
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Activation Required</p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">This activation link is not valid</h1>
            <p className="mt-3 text-sm text-slate-600">It may be expired, already used, or replaced by a newer link. Ask AHAWC to resend your customer activation email.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Go to sign in</Link>
          </div>
        )}
      </div>
    </main>
  )
}
