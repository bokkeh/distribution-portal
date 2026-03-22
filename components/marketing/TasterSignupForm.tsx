'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { registerTaster } from '@/actions/taster-signup'

export function TasterSignupForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(registerTaster, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      const params = new URLSearchParams({ email: state.email, from: 'taster-signup' })
      router.push(`/login?${params.toString()}`)
    }
  }, [state, router])

  if (state && 'success' in state && state.success) {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-400/30 bg-green-500/20">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xl font-bold text-white">Taster account created!</p>
          <p className="text-sm leading-relaxed text-slate-300">
            Redirecting you to sign in to the taster portal...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Taster Sign Up</p>
      <p className="mb-2 text-lg font-bold text-white">Create your taster account</p>
      <p className="mb-4 text-sm text-slate-400">For AHAWC tasting staff and brand ambassadors only.</p>

      {state && 'error' in state && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            name="name"
            type="text"
            placeholder="Jane Smith"
            required
            autoComplete="name"
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            name="email"
            type="email"
            placeholder="jane@example.com"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Phone
          </label>
          <input
            name="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Confirm Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Creating taster account...' : 'Create Taster Account'}
        </button>

        <p className="pt-1 text-center text-xs leading-relaxed text-slate-500">
          By creating an account you agree to our{' '}
          <Link href="/privacy" className="text-slate-400 underline underline-offset-2 hover:text-white">Privacy Policy</Link>
          {' '}and{' '}
          <Link href="/terms" className="text-slate-400 underline underline-offset-2 hover:text-white">Terms &amp; Conditions</Link>.
        </p>
      </form>
    </div>
  )
}
