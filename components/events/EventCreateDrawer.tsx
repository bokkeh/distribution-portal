'use client'

import { useEffect, useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import { createEvent } from '@/actions/events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EVENT_TYPES, RSVP_OPTIONAL_FIELDS } from '@/lib/events/utils'

type AccountOption = { id: string; companyName: string; address: string | null; city: string | null; state: string | null }
type UserOption = { id: string; name: string }

function dateValue(offsetDays = 0) {
  const value = new Date(Date.now() + offsetDays * 86400000)
  return value.toISOString().slice(0, 10)
}

export function EventCreateDrawer({ accounts, organizers }: { accounts: AccountOption[]; organizers: UserOption[] }) {
  const [open, setOpen] = useState(false)
  const [locationMode, setLocationMode] = useState<'manual' | 'account'>('manual')

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="bg-[#ff5a00] hover:bg-[#e65000]"><CalendarPlus className="h-4 w-4" />Add Event</Button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button type="button" aria-label="Close event form" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="create-event-title" className="relative h-full w-full max-w-2xl overflow-y-auto bg-[#f7f4ef] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ff5a00]">Create → Promote → Gather</p><h2 id="create-event-title" className="font-display text-2xl font-bold uppercase">Add Event</h2></div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></Button>
            </div>
            <form action={createEvent} className="space-y-7 p-5 sm:p-7">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold">Core information</h3>
                <div className="space-y-2"><Label htmlFor="new-event-title">Event title</Label><Input id="new-event-title" name="title" required maxLength={160} /></div>
                <div className="space-y-2"><Label htmlFor="new-event-description">Description</Label><textarea id="new-event-description" name="description" className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="new-event-type">Event type</Label><select id="new-event-type" name="eventType" defaultValue="community_event" className="w-full">{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="new-event-organizer">Organizer / owner</Label><select id="new-event-organizer" name="organizerUserId" defaultValue="" className="w-full"><option value="">Me</option>{organizers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="new-event-start-date">Start date</Label><Input id="new-event-start-date" name="startDate" type="date" required defaultValue={dateValue(7)} /></div>
                  <div className="space-y-2"><Label htmlFor="new-event-start-time">Start time</Label><Input id="new-event-start-time" name="startTime" type="time" required defaultValue="18:00" /></div>
                  <div className="space-y-2"><Label htmlFor="new-event-end-date">End date</Label><Input id="new-event-end-date" name="endDate" type="date" required defaultValue={dateValue(7)} /></div>
                  <div className="space-y-2"><Label htmlFor="new-event-end-time">End time</Label><Input id="new-event-end-time" name="endTime" type="time" required defaultValue="21:00" /></div>
                  <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-event-time-zone">Time zone</Label><select id="new-event-time-zone" name="timeZone" defaultValue="America/New_York" className="w-full"><option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Los_Angeles">Pacific</option></select></div>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div><h3 className="font-semibold">Location</h3><p className="text-sm text-slate-500">Use a CRM account or enter a venue manually.</p></div>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button type="button" onClick={() => setLocationMode('manual')} className={`rounded-lg px-3 py-2 text-sm font-medium ${locationMode === 'manual' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Manual location</button>
                  <button type="button" onClick={() => setLocationMode('account')} className={`rounded-lg px-3 py-2 text-sm font-medium ${locationMode === 'account' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Existing account</button>
                </div>
                <input type="hidden" name="locationMode" value={locationMode} />
                {locationMode === 'account' ? (
                  <div className="space-y-2"><Label htmlFor="new-event-account">CRM account</Label><select id="new-event-account" name="accountId" required className="w-full"><option value="">Search/select an account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.companyName} · {[account.city, account.state].filter(Boolean).join(', ')}</option>)}</select><p className="text-xs text-slate-500">Address, primary contact, phone, and website will be copied from the account.</p></div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-event-venue">Venue name</Label><Input id="new-event-venue" name="venueName" /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-event-address">Address</Label><Input id="new-event-address" name="addressLine1" /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-event-address-2">Address line 2</Label><Input id="new-event-address-2" name="addressLine2" /></div>
                    <div className="space-y-2"><Label htmlFor="new-event-city">City</Label><Input id="new-event-city" name="city" /></div>
                    <div className="space-y-2"><Label htmlFor="new-event-state">State</Label><Input id="new-event-state" name="state" /></div>
                    <div className="space-y-2"><Label htmlFor="new-event-zip">ZIP</Label><Input id="new-event-zip" name="postalCode" /></div>
                    <div className="space-y-2"><Label htmlFor="new-event-country">Country</Label><Input id="new-event-country" name="country" defaultValue="US" /></div>
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div><h3 className="font-semibold">RSVP form and source</h3><p className="text-sm text-slate-500">Choose the optional fields shown on the public page.</p></div>
                <div className="grid gap-2 sm:grid-cols-2">{RSVP_OPTIONAL_FIELDS.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="rsvpOptionalFields" value={value} defaultChecked={value === 'guest_names' || value === 'marketing_consent' || value === 'sms_consent'} />{label}</label>)}</div>
                <div className="space-y-2"><Label htmlFor="new-event-source">Source / channel</Label><Input id="new-event-source" name="sourceChannel" placeholder="Instagram, partner newsletter, QR poster…" /></div>
              </section>
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-[#f7f4ef] py-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="bg-[#ff5a00] hover:bg-[#e65000]">Create draft event</Button></div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  )
}
