'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { joinBrandCommunity } from '@/actions/crm-people'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CommunitySignupForm() {
  const [state, action, pending] = useActionState(joinBrandCommunity, null)

  if (state?.success) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h2 className="font-display mt-4 text-3xl font-bold uppercase text-[#181615]">You’re in.</h2>
        <p className="mt-2 text-slate-600">Watch your inbox for Wisher news, events, and community updates.</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <div className="hidden" aria-hidden="true"><Label htmlFor="community-website">Website</Label><Input id="community-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="community-first-name">First name</Label><Input id="community-first-name" name="firstName" required autoComplete="given-name" /></div>
        <div className="space-y-2"><Label htmlFor="community-last-name">Last name</Label><Input id="community-last-name" name="lastName" required autoComplete="family-name" /></div>
        <div className="space-y-2"><Label htmlFor="community-email">Email</Label><Input id="community-email" name="email" type="email" required autoComplete="email" /></div>
        <div className="space-y-2"><Label htmlFor="community-phone">Phone number</Label><Input id="community-phone" name="phone" type="tel" required autoComplete="tel" /></div>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <input type="checkbox" name="marketingConsent" required className="mt-1 accent-[#ff5a00]" />
        <span>I agree to receive Wisher brand news, event announcements, and occasional marketing messages. I can unsubscribe at any time.</span>
      </label>
      {state?.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-11 w-full bg-[#ff5a00] font-display text-base uppercase hover:bg-[#e65000]">{pending ? 'Joining…' : 'Join the community'}</Button>
    </form>
  )
}
