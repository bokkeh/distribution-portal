import { ClipboardCheck, HandHeart, PackageCheck, UsersRound } from 'lucide-react'
import { saveEventPlanning, saveEventRecap } from '@/actions/events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EventRecord } from '@/db/schema'
import { getEventPlanningCompletion } from '@/lib/events/utils'

type ContactOption = { id: string; name: string; email: string | null; phone: string | null; accountName: string | null }
type ProductOption = { id: string; name: string; sku: string }
type UserOption = { id: string; name: string }

const textareaClass = 'min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm'

function localDateTimeValue(value: Date | null, timeZone: string) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

function LinesField({ label, name, values, placeholder }: { label: string; name: string; values: string[]; placeholder: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><textarea id={name} name={name} defaultValue={values.join('\n')} placeholder={placeholder} className={textareaClass} /><p className="text-xs text-slate-500">Enter one item per line. Custom items are welcome.</p></div>
}

export function EventInternalPlanning({
  event,
  contacts,
  products,
  teamUsers,
}: {
  event: EventRecord
  contacts: ContactOption[]
  products: ProductOption[]
  teamUsers: UserOption[]
}) {
  const completion = getEventPlanningCompletion(event)

  return (
    <div className="space-y-6">
      <Card className="border-orange-200">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#ff5a00]" />Internal Planning</CardTitle><Badge variant={completion === 100 ? 'success' : 'warning'}>{completion}% complete</Badge></div>
          <p className="text-sm text-slate-500">Private operational information. None of the fields in this section are rendered on the public event page.</p>
        </CardHeader>
        <CardContent>
          <form action={saveEventPlanning} className="space-y-8">
            <input type="hidden" name="eventId" value={event.id} />

            <section className="space-y-4">
              <h3 className="font-semibold text-slate-900">Logistics</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="teamArrivalAt">Team arrival</Label><Input id="teamArrivalAt" name="teamArrivalAt" type="datetime-local" defaultValue={localDateTimeValue(event.teamArrivalAt, event.timeZone)} /></div>
                <div className="space-y-2"><Label htmlFor="setupAt">Setup time</Label><Input id="setupAt" name="setupAt" type="datetime-local" defaultValue={localDateTimeValue(event.setupAt, event.timeZone)} /></div>
                <div className="space-y-2"><Label htmlFor="breakdownAt">Breakdown / load-out</Label><Input id="breakdownAt" name="breakdownAt" type="datetime-local" defaultValue={localDateTimeValue(event.breakdownAt, event.timeZone)} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="parkingInstructions">Parking instructions</Label><textarea id="parkingInstructions" name="parkingInstructions" defaultValue={event.parkingInstructions ?? ''} className={textareaClass} /></div>
                <div className="space-y-2"><Label htmlFor="unloadingInstructions">Unloading instructions</Label><textarea id="unloadingInstructions" name="unloadingInstructions" defaultValue={event.unloadingInstructions ?? ''} className={textareaClass} /></div>
                <div className="space-y-2"><Label htmlFor="internalLogisticsNotes">Internal logistics notes</Label><textarea id="internalLogisticsNotes" name="internalLogisticsNotes" defaultValue={event.internalLogisticsNotes ?? ''} className={textareaClass} /></div>
                <div className="space-y-2"><Label htmlFor="dressCode">Dress code</Label><Input id="dressCode" name="dressCode" defaultValue={event.dressCode ?? ''} /></div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Event start: {event.startAt ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timeZone }).format(event.startAt) : 'not set'} · Event end: {event.endAt ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timeZone }).format(event.endAt) : 'not set'}</div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-slate-900">Contacts</h3>
              {([['planning', 'Planning POC'], ['dayOf', 'Day-of Event POC']] as const).map(([prefix, label]) => {
                const linkedId = prefix === 'planning' ? event.planningPocContactId : event.dayOfPocContactId
                const name = prefix === 'planning' ? event.planningPocName : event.dayOfPocName
                const email = prefix === 'planning' ? event.planningPocEmail : event.dayOfPocEmail
                const phone = prefix === 'planning' ? event.planningPocPhone : event.dayOfPocPhone
                return <div key={prefix} className="rounded-xl border p-4"><p className="mb-3 text-sm font-semibold">{label}</p><div className="grid gap-3 md:grid-cols-4"><select name={`${prefix}PocContactId`} defaultValue={linkedId ?? ''} className="w-full"><option value="">No linked CRM contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.accountName ? ` · ${contact.accountName}` : ''}</option>)}</select><Input name={`${prefix}PocName`} defaultValue={name ?? ''} placeholder="Name" /><Input name={`${prefix}PocEmail`} type="email" defaultValue={email ?? ''} placeholder="Email" /><Input name={`${prefix}PocPhone`} type="tel" defaultValue={phone ?? ''} placeholder="Phone" /></div></div>
              })}
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900"><UsersRound className="h-4 w-4 text-[#ff5a00]" />Attendance and team</h3>
              <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Expected attendees</Label><Input name="expectedAttendees" type="number" min="0" step="1" defaultValue={event.expectedAttendees ?? ''} /></div><div className="space-y-2"><Label>Estimated people served</Label><Input name="estimatedPeopleServed" type="number" min="0" step="1" defaultValue={event.estimatedPeopleServed ?? ''} /></div></div>
              <div><p className="mb-2 text-sm font-medium">Assigned team members</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{teamUsers.map((user) => <label key={user.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" name="assignedTeamMemberId" value={user.id} defaultChecked={event.assignedTeamMemberIds.includes(user.id)} />{user.name}</label>)}</div></div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900"><PackageCheck className="h-4 w-4 text-[#ff5a00]" />Wisher activation</h3>
              <LinesField label="Cocktails being served" name="cocktailsServed" values={event.cocktailsServed} placeholder="Wisher Mule\nEspresso Martini" />
              <div><p className="mb-2 text-sm font-medium">Products being served</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <label key={product.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" name="productId" value={product.id} defaultChecked={event.productIds.includes(product.id)} />{product.name} · {product.sku}</label>)}</div></div>
              <div className="space-y-2"><Label htmlFor="estimatedProductRequired">Estimated product required</Label><Input id="estimatedProductRequired" name="estimatedProductRequired" defaultValue={event.estimatedProductRequired ?? ''} placeholder="Example: 24 bottles Wisher Vodka" /></div>
              <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sellingProduct" defaultChecked={event.sellingProduct} />Selling product</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="samplingProduct" defaultChecked={event.samplingProduct} />Sampling product</label></div>
            </section>

            <section className="grid gap-5 border-t pt-6 md:grid-cols-2">
              <LinesField label="What Wisher provides" name="wisherProvides" values={event.wisherProvides} placeholder="Vodka\nStaff\nSignage\nBar materials" />
              <LinesField label="What partner / venue provides" name="partnerProvides" values={event.partnerProvides} placeholder="Mixers\nIce\nGlassware\nTables" />
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900"><HandHeart className="h-4 w-4 text-[#ff5a00]" />Donation / sponsorship</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="donationEnabled" defaultChecked={event.donationEnabled} />This event includes a donation or sponsorship</label>
              <div className="grid gap-4 md:grid-cols-4"><div className="space-y-2"><Label>Type</Label><select name="donationType" defaultValue={event.donationType ?? ''} className="w-full"><option value="">Choose type</option>{['Cash', 'Product', 'Silent auction item', 'Mixers', 'Merchandise', 'Other'].map((type) => <option key={type} value={type}>{type}</option>)}</select></div><div className="space-y-2"><Label>Dollar value</Label><Input name="donationValue" type="number" min="0" step="0.01" defaultValue={event.donationValue ?? ''} /></div><div className="space-y-2"><Label>Product</Label><select name="donationProductId" defaultValue={event.donationProductId ?? ''} className="w-full"><option value="">No linked product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><div className="space-y-2"><Label>Quantity</Label><Input name="donationQuantity" type="number" min="0" step="0.01" defaultValue={event.donationQuantity ?? ''} /></div></div>
              <div className="space-y-2"><Label>Donation notes</Label><textarea name="donationNotes" defaultValue={event.donationNotes ?? ''} className={textareaClass} /></div>
            </section>

            <Button type="submit">Save internal planning</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-emerald-200">
        <CardHeader><CardTitle>Post-event recap</CardTitle><p className="text-sm text-slate-500">Private results and lessons that remain attached to this event for future reporting.</p></CardHeader>
        <CardContent>
          <form action={saveEventRecap} className="space-y-5">
            <input type="hidden" name="eventId" value={event.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="space-y-2"><Label>Actual people served</Label><Input name="actualPeopleServed" type="number" min="0" step="1" defaultValue={event.actualPeopleServed ?? ''} /></div><div className="space-y-2"><Label>Bottles used</Label><Input name="bottlesUsed" type="number" min="0" step="0.01" defaultValue={event.bottlesUsed ?? ''} /></div><div className="space-y-2"><Label>Cases used</Label><Input name="casesUsed" type="number" min="0" step="0.01" defaultValue={event.casesUsed ?? ''} /></div><div className="space-y-2"><Label>Sales generated</Label><Input name="salesGenerated" type="number" min="0" step="0.01" defaultValue={event.salesGenerated ?? ''} /></div><div className="space-y-2"><Label>Leads collected</Label><Input name="leadsCollected" type="number" min="0" step="1" defaultValue={event.leadsCollected ?? ''} /></div></div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Product used</Label><textarea name="productUsed" defaultValue={event.productUsed ?? ''} className={textareaClass} /></div><div className="space-y-2"><Label>Product remaining</Label><textarea name="productRemaining" defaultValue={event.productRemaining ?? ''} className={textareaClass} /></div><div className="space-y-2"><Label>Internal recap</Label><textarea name="internalRecap" defaultValue={event.internalRecap ?? ''} className={textareaClass} /></div><div className="space-y-2"><Label>What worked</Label><textarea name="whatWorked" defaultValue={event.whatWorked ?? ''} className={textareaClass} /></div><div className="space-y-2"><Label>What didn&apos;t</Label><textarea name="whatDidnt" defaultValue={event.whatDidnt ?? ''} className={textareaClass} /></div><div className="space-y-2"><Label>Follow-up actions</Label><textarea name="followUpActions" defaultValue={event.followUpActions ?? ''} className={textareaClass} /></div></div>
            <p className="text-xs text-slate-500">Upload recap photos in the Media manager below and choose Internal placement to keep them private.</p>
            <Button type="submit">Save post-event recap</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
