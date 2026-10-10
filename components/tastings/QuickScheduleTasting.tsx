'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { quickScheduleTasting } from '@/actions/quick-schedule-tasting'
import { getAccountTastingLocations } from '@/lib/tastings/locations'
import { COMMON_TIME_ZONES } from '@/lib/timezones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import { singleFlight } from '@/lib/tastings/scheduling'

type Account = { id: string; companyName: string; address: string | null; city: string | null; state: string | null; zip: string | null; additionalLocations?: string | null }

export function QuickScheduleTasting({ accounts, members, initialAccountId, date, initialMemberId, hideAccountPicker = false, onSaved }: {
  accounts: Account[]; members: { id: string; name: string }[]; initialAccountId?: string; date: string; initialMemberId?: string; hideAccountPicker?: boolean; onSaved?: () => void | Promise<void>
}) {
  const router = useRouter()
  const id = useId()
  const [accountId, setAccountId] = useState(initialAccountId ?? '')
  const [newVenue, setNewVenue] = useState(false)
  const [locationIndex, setLocationIndex] = useState('0')
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const requestId = useRef<string | null>(null)
  const save = useRef(singleFlight(quickScheduleTasting))
  const formRef = useRef<HTMLFormElement>(null)
  const account = accounts.find(account => account.id === accountId)
  const inputClass = 'flex h-11 w-full rounded-md border border-input bg-white px-3 text-base'
  const locations = account ? getAccountTastingLocations(account) : []

  return <div id="quick-schedule-tasting" className="space-y-4 scroll-mt-4">
    <h2 className="text-lg font-semibold">Quick schedule tasting</h2>
    {confirmation ? <div role="status" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
      <p className="font-semibold">Tasting saved</p><p>{confirmation}</p>
      <Button type="button" onClick={() => {
        requestId.current = null; setConfirmation(''); setError(''); formRef.current?.reset()
      }}>Schedule next tasting</Button>
    </div> : null}
    <form ref={formRef} hidden={!!confirmation} className="space-y-4" onSubmit={async event => {
      event.preventDefault()
      if (pending) return
      const data = new FormData(event.currentTarget)
      requestId.current ??= crypto.randomUUID()
      setPending(true); setError('')
      try {
        const result = await save.current({
          requestId: requestId.current, accountId: newVenue ? null : accountId || null,
          venueName: String(data.get('venueName') ?? ''), venueAddress: String(data.get('address') ?? ''),
          venueCity: String(data.get('city') ?? ''), venueState: String(data.get('state') ?? ''), venueZip: String(data.get('zip') ?? ''),
          locationIndex: newVenue ? 0 : Number(locationIndex), date: String(data.get('date') ?? ''),
          startTime: String(data.get('startTime') ?? ''), endTime: String(data.get('endTime') ?? ''),
          timeZone: String(data.get('timeZone') ?? ''), assignedUserId: String(data.get('assignedUserId') ?? '') || null,
          contact: String(data.get('contact') ?? ''), notes: String(data.get('notes') ?? ''),
        })
        if (result.error) { setError(result.error); return }
        setConfirmation(result.confirmation!); router.refresh(); if (onSaved) await onSaved()
      } catch { setError('Could not confirm the save. Check your connection and retry; your details are kept.') }
      finally { setPending(false) }
    }}>
      <fieldset disabled={pending} className="space-y-4">
        {!hideAccountPicker ? <div className="space-y-2">
          <Label htmlFor={`${id}-account`}>Account / venue</Label>
          <select id={`${id}-account`} value={newVenue ? '__new' : accountId} required className={inputClass} onChange={event => {
            setNewVenue(event.target.value === '__new'); setAccountId(event.target.value === '__new' ? '' : event.target.value); setLocationIndex('0')
          }}>
            <option value="">Choose an existing account</option><option value="__new">+ New venue (enrich later)</option>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.companyName}{account.city ? ` · ${account.city}, ${account.state ?? ''}` : ''}</option>)}
          </select>
        </div> : null}
        {newVenue ? <div className="space-y-3">
          <Label htmlFor={`${id}-venue`}>Venue name</Label><Input id={`${id}-venue`} name="venueName" required className="text-base" />
          <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">Venue address (optional)</summary><div className="mt-3 space-y-2">
            <Label htmlFor={`${id}-address`}>Street address</Label><AddressAutocomplete id={`${id}-address`} name="address" className={inputClass} />
            <Label htmlFor={`${id}-city`}>City</Label><Input id={`${id}-city`} name="city" />
            <Label htmlFor={`${id}-state`}>State</Label><Input id={`${id}-state`} name="state" />
            <Label htmlFor={`${id}-zip`}>ZIP</Label><Input id={`${id}-zip`} name="zip" />
          </div></details>
        </div> : locations.length > 1 ? <div className="space-y-2"><Label htmlFor={`${id}-location`}>Location</Label><select id={`${id}-location`} value={locationIndex} className={inputClass} onChange={event => setLocationIndex(event.target.value)}>{locations.map((location, index) => <option key={index} value={index}>{[location.address, location.city, location.state, location.zip].filter(Boolean).join(', ') || 'Account location'}</option>)}</select></div> : null}
        <div className="space-y-2"><Label htmlFor={`${id}-date`}>Date</Label><Input id={`${id}-date`} name="date" type="date" key={date} defaultValue={date} required className="text-base" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor={`${id}-start`}>Start time</Label><Input id={`${id}-start`} name="startTime" type="time" defaultValue="16:00" required className="text-base" /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-end`}>End time</Label><Input id={`${id}-end`} name="endTime" type="time" defaultValue="19:00" required className="text-base" /></div>
        </div>
        <div className="space-y-2"><Label htmlFor={`${id}-zone`}>Venue timezone</Label><select id={`${id}-zone`} name="timeZone" defaultValue="America/New_York" className={inputClass}>{COMMON_TIME_ZONES.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select><p className="text-xs text-muted-foreground">Times are local to the selected venue timezone. Confirm this for venues outside Eastern Time.</p></div>
        <div className="space-y-2"><Label htmlFor={`${id}-member`}>Assigned team member</Label><select id={`${id}-member`} name="assignedUserId" defaultValue={initialMemberId ?? ''} className={inputClass}><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">Contact and notes (optional)</summary><div className="mt-3 space-y-3">
          <Label htmlFor={`${id}-contact`}>Venue contact</Label><Input id={`${id}-contact`} name="contact" />
          <Label htmlFor={`${id}-notes`}>Notes</Label><textarea id={`${id}-notes`} name="notes" className="min-h-20 w-full rounded-md border px-3 py-2 text-base" />
        </div></details>
      </fieldset>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={pending} className="h-11 w-full">{pending ? 'Saving…' : 'Schedule tasting'}</Button>
    </form>
  </div>
}
