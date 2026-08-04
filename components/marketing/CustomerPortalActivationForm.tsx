'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { acceptCustomerPortalInvite, type CustomerPortalSignupState } from '@/actions/customer-portal-invites'

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'

export function CustomerPortalActivationForm({
  token,
  email,
  businessName,
  defaultName,
}: {
  token: string
  email: string
  businessName: string
  defaultName?: string | null
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<CustomerPortalSignupState, FormData>(acceptCustomerPortalInvite, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      router.push(`/login?${new URLSearchParams({ email: state.email, from: 'customer-activation' })}`)
    }
  }, [router, state])

  if (state && 'success' in state && state.success) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
        <h2 className="text-xl font-bold text-slate-900">Portal access activated</h2>
        <p className="mt-2 text-sm text-slate-600">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Approved Account</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">Set up {businessName}</h2>
      <p className="mt-2 text-sm text-slate-600">Create the password you will use to place orders and manage this account.</p>

      {state && 'error' in state && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Full name</span>
          <input name="name" defaultValue={defaultName ?? ''} required autoComplete="name" className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Approved email</span>
          <input value={email} disabled className={`${inputClass} cursor-not-allowed opacity-70`} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Password</span>
          <div className="relative">
            <input name="password" type={showPassword ? 'text' : 'password'} minLength={8} required autoComplete="new-password" className={`${inputClass} pr-10`} />
            <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Show or hide password">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirm password</span>
          <div className="relative">
            <input name="confirmPassword" type={showConfirm ? 'text' : 'password'} minLength={8} required autoComplete="new-password" className={`${inputClass} pr-10`} />
            <button type="button" onClick={() => setShowConfirm(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Show or hide confirmation">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <button disabled={pending} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? 'Activating…' : 'Activate Portal Access'}
        </button>
      </form>
    </div>
  )
}
