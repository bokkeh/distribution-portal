'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { submitWholesaleAccountRequest } from '@/actions/marketing'
import { BUSINESS_TYPE_OPTIONS } from '@/lib/customers/business-types'
import { SMS_CONSENT_COPY } from '@/lib/telnyx/messages'

const initialState = null

const fieldClassName =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export function JoinRequestForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(submitWholesaleAccountRequest, initialState)

  if (state?.success) {
    return (
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_22px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xl font-bold text-slate-900">Request received</p>
          <p className="text-sm leading-relaxed text-slate-600">
            Thank you for applying. Our team will review your request and follow up at your business email within 1-2 business days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset()
            window.location.assign('/join')
          }}
          className="text-sm font-medium text-slate-600 underline underline-offset-2 transition-colors hover:text-slate-900"
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.35)] sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Wholesale Access</p>
      <p className="mb-2 text-lg font-bold text-slate-900">Request your account</p>
      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        Share your business details and our team will review your request.
      </p>

      {state?.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-3">
        <input type="hidden" name="source" value="join_page" />
        <input type="hidden" name="submissionPage" value="/join" />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              name="businessName"
              type="text"
              placeholder="Acme Restaurants LLC"
              required
              className={fieldClassName}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Business Type</label>
            <select
              name="businessType"
              defaultValue=""
              className={fieldClassName}
            >
              <option value="">Select type...</option>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Business Email <span className="text-red-500">*</span>
          </label>
          <input
            name="businessEmail"
            type="email"
            placeholder="orders@yourbusiness.com"
            required
            autoComplete="email"
            className={fieldClassName}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Mobile Phone <span className="text-red-500">*</span>
          </label>
          <input
            name="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            required
            autoComplete="tel"
            className={fieldClassName}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-600">
          <input
            name="smsOptIn"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
          />
          <span className="leading-snug">
            I agree to receive SMS messages from AHAWC about my wholesale account request and account setup.
          </span>
        </label>

        <p className="text-xs leading-relaxed text-slate-500">
          {SMS_CONSENT_COPY} See our{' '}
          <Link href="/privacy" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
            Terms &amp; Conditions
          </Link>
          .
        </p>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
