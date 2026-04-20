'use client'

import { useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { submitWholesaleAccountRequest } from '@/actions/marketing'
import { BUSINESS_TYPE_OPTIONS } from '@/lib/customers/business-types'
import { SMS_CONSENT_COPY } from '@/lib/telnyx/messages'

const initialState = null
const fieldClassName =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export function WholesaleAccountRequestForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(submitWholesaleAccountRequest, initialState)

  useEffect(() => {
    if (state?.error) {
      toast.error('Unable to submit request', { description: state.error })
      return
    }

    if (state?.success) {
      formRef.current?.reset()
      toast.success('Request received', {
        description: 'We saved your details and will follow up shortly.',
      })
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)]">
      <input type="hidden" name="source" value="marketing_contact_form" />
      <input type="hidden" name="submissionPage" value="/#contact" />

      <p className="text-lg font-bold text-slate-900">Request a Wholesale Account</p>
      <input
        name="businessName"
        type="text"
        placeholder="Business name"
        required
        className={fieldClassName}
      />
      <input
        name="businessEmail"
        type="email"
        placeholder="Business email"
        required
        className={fieldClassName}
      />
      <select
        name="businessType"
        defaultValue=""
        className={fieldClassName}
      >
        <option value="">Business type</option>
        {BUSINESS_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <input
        name="phone"
        type="tel"
        placeholder="Mobile phone number"
        required
        autoComplete="tel"
        className={fieldClassName}
      />

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <input
          name="smsOptIn"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600"
        />
        <span>
          I agree to receive SMS messages from AHAWC about my wholesale account request and account setup.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-slate-500">
        {SMS_CONSENT_COPY} See our{' '}
        <Link href="/privacy" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          Terms &amp; Conditions
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? 'Submitting...' : 'Send Request'}
      </button>
    </form>
  )
}
