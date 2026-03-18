'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { submitWholesaleAccountRequest } from '@/actions/marketing'
import { SMS_CONSENT_COPY } from '@/lib/telnyx/messages'

const initialState = null

export function JoinRequestForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [state, formAction, pending] = useActionState(submitWholesaleAccountRequest, initialState)

  useEffect(() => {
    if (state?.success) {
      setSubmitted(true)
    }
  }, [state])

  if (submitted) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 border border-green-400/30">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xl font-bold text-white">Request received!</p>
          <p className="text-slate-300 text-sm leading-relaxed">
            Thank you for applying. Our team will review your request and follow up at your business email within 1–2 business days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSubmitted(false); formRef.current?.reset() }}
          className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-1">
      <p className="text-lg font-bold text-white mb-4">Request Wholesale Access</p>

      {state?.error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 mb-4">
          {state.error}
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-3">
        <input type="hidden" name="source" value="join_page" />
        <input type="hidden" name="submissionPage" value="/join" />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Business Name <span className="text-red-400">*</span></label>
            <input
              name="businessName"
              type="text"
              placeholder="Acme Restaurants LLC"
              required
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Business Type</label>
            <select
              name="businessType"
              defaultValue=""
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="" className="bg-slate-900">Select type…</option>
              <option value="restaurant" className="bg-slate-900">Restaurant</option>
              <option value="restaurant_group" className="bg-slate-900">Restaurant Group</option>
              <option value="liquor_store" className="bg-slate-900">Liquor Store</option>
              <option value="hotel_group" className="bg-slate-900">Hotel Group</option>
              <option value="bar" className="bg-slate-900">Bar / Nightclub</option>
              <option value="catering" className="bg-slate-900">Catering Company</option>
              <option value="other" className="bg-slate-900">Other</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Business Email <span className="text-red-400">*</span></label>
          <input
            name="businessEmail"
            type="email"
            placeholder="orders@yourbusiness.com"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Mobile Phone <span className="text-red-400">*</span></label>
          <input
            name="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            required
            autoComplete="tel"
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm text-slate-300 cursor-pointer">
          <input
            name="smsOptIn"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-blue-500"
          />
          <span className="leading-snug">
            I agree to receive SMS messages from AHAWC about my wholesale account request and account setup.
          </span>
        </label>

        <p className="text-xs leading-relaxed text-slate-500">
          {SMS_CONSENT_COPY} See our{' '}
          <Link href="/privacy" className="text-slate-400 underline underline-offset-2 hover:text-white">Privacy Policy</Link>
          {' '}and{' '}
          <Link href="/terms" className="text-slate-400 underline underline-offset-2 hover:text-white">Terms &amp; Conditions</Link>.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
