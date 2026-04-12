'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { acceptSalesRepInvite, type SalesRepInviteSignupState } from '@/actions/sales-rep-invites'

function inputClassName() {
  return 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
}

export function SalesRepInviteSignupForm({
  token,
  defaultEmail,
  defaultName,
  defaultPhone,
}: {
  token: string
  defaultEmail: string
  defaultName?: string | null
  defaultPhone?: string | null
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<SalesRepInviteSignupState, FormData>(acceptSalesRepInvite, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      const params = new URLSearchParams({ email: state.email, from: 'sales-rep-signup' })
      router.push(`/login?${params.toString()}`)
    }
  }, [router, state])

  if (state && 'success' in state && state.success) {
    return (
      <div className="space-y-4 rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xl font-bold text-slate-900">Sales rep account created</p>
          <p className="text-sm leading-relaxed text-slate-600">
            Redirecting you to sign in to the sales portal...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Sales Rep Invite</p>
      <p className="mb-2 text-lg font-bold text-slate-900">Create your sales rep account</p>
      <p className="mb-4 text-sm text-slate-600">Set your password to activate access to the AHAWC sales portal.</p>

      {state && 'error' in state && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            defaultValue={defaultName ?? ''}
            required
            autoComplete="name"
            className={inputClassName()}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            name="email"
            type="email"
            defaultValue={defaultEmail}
            required
            autoComplete="email"
            className={inputClassName()}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone</label>
          <input
            name="phone"
            type="tel"
            defaultValue={defaultPhone ?? ''}
            autoComplete="tel"
            className={inputClassName()}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className={`${inputClassName()} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
              className={`${inputClassName()} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Creating sales rep account...' : 'Create Sales Rep Account'}
        </button>

        <p className="pt-1 text-center text-xs leading-relaxed text-slate-500">
          By creating an account you agree to our{' '}
          <Link href="/privacy" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">Privacy Policy</Link>
          {' '}and{' '}
          <Link href="/terms" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">Terms &amp; Conditions</Link>.
        </p>
      </form>
    </div>
  )
}
