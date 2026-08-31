'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { submitEventRsvp } from '@/actions/events-public'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PublicEventRsvpForm({ slug, optionalFields }: { slug: string; optionalFields: string[] }) {
  const [state, action, pending] = useActionState(submitEventRsvp, null)
  if (state?.success) return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h3 className="font-display mt-3 text-2xl font-bold uppercase">You’re confirmed</h3><p className="mt-2 text-sm text-emerald-800">Check your inbox for event details, directions, and your calendar link.</p>{state.managementUrl ? <Button asChild className="mt-5"><Link href={state.managementUrl}>Manage RSVP</Link></Button> : null}</div>
  const show = (field: string) => optionalFields.includes(field)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} /><div className="hidden" aria-hidden="true"><Label htmlFor="event-rsvp-website">Website</Label><Input id="event-rsvp-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="event-rsvp-first">First name</Label><Input id="event-rsvp-first" name="firstName" required autoComplete="given-name" /></div><div className="space-y-2"><Label htmlFor="event-rsvp-last">Last name</Label><Input id="event-rsvp-last" name="lastName" required autoComplete="family-name" /></div><div className="space-y-2"><Label htmlFor="event-rsvp-email">Email</Label><Input id="event-rsvp-email" name="email" type="email" required autoComplete="email" /></div><div className="space-y-2"><Label htmlFor="event-rsvp-phone">Mobile phone</Label><Input id="event-rsvp-phone" name="phone" type="tel" required autoComplete="tel" /></div></div>
      {show('guest_names') ? <div className="grid gap-4 sm:grid-cols-[9rem_1fr]"><div className="space-y-2"><Label htmlFor="event-rsvp-guests">Number of guests</Label><Input id="event-rsvp-guests" name="guestCount" type="number" min="0" max="20" defaultValue="0" /></div><div className="space-y-2"><Label htmlFor="event-rsvp-guest-names">Guest names</Label><Input id="event-rsvp-guest-names" name="guestNames" placeholder="Separate names with commas" /></div></div> : <input type="hidden" name="guestCount" value="0" />}
      {show('company') ? <div className="space-y-2"><Label htmlFor="event-rsvp-company">Company</Label><Input id="event-rsvp-company" name="company" /></div> : null}
      {show('instagram') ? <div className="space-y-2"><Label htmlFor="event-rsvp-instagram">Instagram handle</Label><Input id="event-rsvp-instagram" name="instagramHandle" placeholder="@handle" /></div> : null}
      {show('notes') ? <div className="space-y-2"><Label htmlFor="event-rsvp-notes">Notes</Label><textarea id="event-rsvp-notes" name="notes" className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /></div> : null}
      {show('marketing_consent') ? <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><input type="checkbox" name="marketingConsent" className="mt-1 accent-[#ff5a00]" /><span>Send me occasional Wisher news and future event announcements. I can unsubscribe at any time.</span></label> : null}
      {show('sms_consent') ? <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><input type="checkbox" name="smsConsent" className="mt-1 accent-[#ff5a00]" /><span>Text me this event confirmation and updates. Message and data rates may apply. Reply STOP to opt out.</span></label> : null}
      {state?.error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-12 w-full bg-[#ff5a00] font-display text-lg uppercase hover:bg-[#e65000]">{pending ? 'Confirming…' : 'Confirm RSVP'}</Button>
    </form>
  )
}
