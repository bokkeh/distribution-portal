'use client'

import { useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { submitWholesaleAccountRequest } from '@/actions/marketing'
import { SMS_CONSENT_COPY } from '@/lib/telnyx/messages'

const initialState = null

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
    <form ref={formRef} action={formAction} className="bg-white/10 rounded-xl p-6 space-y-3">
      <input type="hidden" name="source" value="marketing_contact_form" />
      <input type="hidden" name="submissionPage" value="/#contact" />

      <p className="font-semibold text-sm">Request a Wholesale Account</p>
      <input
        name="businessName"
        type="text"
        placeholder="Business name"
        required
        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/30"
      />
      <input
        name="businessEmail"
        type="email"
        placeholder="Business email"
        required
        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/30"
      />
      <select
        name="businessType"
        defaultValue=""
        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <option value="" className="text-slate-900">Business type</option>
        <option value="restaurant" className="text-slate-900">Restaurant</option>
        <option value="restaurant_group" className="text-slate-900">Restaurant Group</option>
        <option value="liquor_store" className="text-slate-900">Liquor Store</option>
        <option value="hotel_group" className="text-slate-900">Hotel Group</option>
      </select>
      <input
        name="phone"
        type="tel"
        placeholder="Mobile phone number"
        required
        autoComplete="tel"
        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/30"
      />

      <label className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-blue-100">
        <input
          name="smsOptIn"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-white/40 bg-transparent accent-amber-400"
        />
        <span>
          I agree to receive SMS messages from AHAWC about my wholesale account request and account setup.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-blue-200">
        {SMS_CONSENT_COPY} See our{' '}
        <Link href="/privacy" className="font-medium text-white underline underline-offset-2">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="font-medium text-white underline underline-offset-2">
          Terms &amp; Conditions
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={pending}
        className="block w-full text-center bg-amber-400 hover:bg-amber-300 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
      >
        {pending ? 'Submitting...' : 'Send Request'}
      </button>
    </form>
  )
}
