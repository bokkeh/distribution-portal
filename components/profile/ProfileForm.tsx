'use client'

import { useActionState, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { updateProfile } from '@/actions/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { User, Building2, Bell, UserCircle, Clock, Truck, MapPin, Plus, Trash2, CreditCard } from 'lucide-react'

interface Location { address: string; city: string; state: string; zip: string }

interface Props {
  user: { id: string; name: string; email: string; phone: string | null }
  account: {
    id: string
    companyName: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    dcAbraNumber: string | null
    businessEmail: string | null
    businessPhone: string | null
    notificationPreference: string | null
    pocName: string | null
    pocPhone: string | null
    pocEmail: string | null
    hoursOfOperation: string | null
    preferredDeliveryDays: string | null
    preferredDeliveryTimes: string | null
    additionalLocations: string | null
    creditLimit: string
    balance: string
    paymentTerms: string | null
  } | null
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className="w-4 h-4 text-muted-foreground" />
      {children}
    </CardTitle>
  )
}

function FieldRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={`grid grid-cols-1 ${cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4`}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}

export function ProfileForm({ user, account }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(updateProfile, null)

  // Local state for reactive fields
  const [state_, setState_] = useState(account?.state ?? '')
  const [selectedDays, setSelectedDays] = useState<string[]>(
    account?.preferredDeliveryDays ? account.preferredDeliveryDays.split(',').map(d => d.trim()).filter(Boolean) : []
  )
  const [extraLocations, setExtraLocations] = useState<Location[]>(
    account?.additionalLocations ? (JSON.parse(account.additionalLocations) as Location[]) : []
  )

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to save', { description: state.error })
    } else if (state && !state.error) {
      toast.success('Profile saved')
    }
  }, [state])

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function addLocation() {
    setExtraLocations(prev => [...prev, { address: '', city: '', state: '', zip: '' }])
  }

  function removeLocation(i: number) {
    setExtraLocations(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateLocation(i: number, field: keyof Location, value: string) {
    setExtraLocations(prev => prev.map((loc, idx) => idx === i ? { ...loc, [field]: value } : loc))
  }

  const isDC = state_.toUpperCase() === 'DC'

  return (
    <form ref={formRef} action={action} className="space-y-6 max-w-2xl">
      <input type="hidden" name="userId" value={user.id} />
      {account && <input type="hidden" name="accountId" value={account.id} />}
      {/* Serialise dynamic fields as hidden inputs */}
      <input type="hidden" name="preferredDeliveryDays" value={selectedDays.join(', ')} />
      <input type="hidden" name="additionalLocations" value={JSON.stringify(extraLocations)} />

      {/* ── Personal Info ─────────────────────────────────── */}
      <Card>
        <CardHeader><SectionTitle icon={User}>Personal Information</SectionTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow>
            <Field label="Full Name">
              <Input name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={user.email} required />
            </Field>
          </FieldRow>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={user.phone ?? ''} placeholder="+1 (555) 000-0000" />
          </Field>
        </CardContent>
      </Card>

      {account && (
        <>
          {/* ── Company Info ─────────────────────────────── */}
          <Card>
            <CardHeader><SectionTitle icon={Building2}>Company Information</SectionTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Company Name">
                <Input name="companyName" defaultValue={account.companyName} required />
              </Field>
              <Field label="Company Address">
                <Input name="address" defaultValue={account.address ?? ''} placeholder="123 Main St" />
              </Field>
              <FieldRow cols={3}>
                <Field label="City">
                  <Input name="city" defaultValue={account.city ?? ''} placeholder="Washington" />
                </Field>
                <Field label="State">
                  <Input
                    name="state"
                    defaultValue={account.state ?? ''}
                    placeholder="DC"
                    maxLength={2}
                    onChange={e => setState_(e.target.value)}
                  />
                </Field>
                <Field label="ZIP">
                  <Input name="zip" defaultValue={account.zip ?? ''} placeholder="20001" />
                </Field>
              </FieldRow>

              {isDC && (
                <Field label="DC ABRA License Number">
                  <Input name="dcAbraNumber" defaultValue={account.dcAbraNumber ?? ''} placeholder="Required for DC establishments" />
                </Field>
              )}

              <FieldRow>
                <Field label="Business Email">
                  <Input name="businessEmail" type="email" defaultValue={account.businessEmail ?? ''} placeholder="orders@mybusiness.com" />
                </Field>
                <Field label="Business Phone">
                  <Input name="businessPhone" type="tel" defaultValue={account.businessPhone ?? ''} placeholder="+1 (555) 000-0000" />
                </Field>
              </FieldRow>

              <Field label="Hours of Operation">
                <Input name="hoursOfOperation" defaultValue={account.hoursOfOperation ?? ''} placeholder="Mon–Fri 9am–9pm, Sat–Sun 10am–8pm" />
              </Field>
            </CardContent>
          </Card>

          {/* ── Notification Preference ───────────────────── */}
          <Card>
            <CardHeader><SectionTitle icon={Bell}>Notification Preferences</SectionTitle></CardHeader>
            <CardContent>
              <Field label="How would you like to receive notifications?">
                <div className="flex flex-wrap gap-3 pt-1">
                  {(['email', 'sms', 'both'] as const).map(opt => {
                    const labels = { email: 'Email only', sms: 'Text (SMS) only', both: 'Both email & text' }
                    return (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="notificationPreference"
                          value={opt}
                          defaultChecked={(account.notificationPreference ?? 'email') === opt}
                          className="accent-blue-600"
                        />
                        <span className="text-sm">{labels[opt]}</span>
                      </label>
                    )
                  })}
                </div>
              </Field>
            </CardContent>
          </Card>

          {/* ── Point of Contact ─────────────────────────── */}
          <Card>
            <CardHeader><SectionTitle icon={UserCircle}>Point of Contact</SectionTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Contact Name">
                <Input name="pocName" defaultValue={account.pocName ?? ''} placeholder="Jane Smith" />
              </Field>
              <FieldRow>
                <Field label="Contact Phone">
                  <Input name="pocPhone" type="tel" defaultValue={account.pocPhone ?? ''} placeholder="+1 (555) 000-0000" />
                </Field>
                <Field label="Contact Email">
                  <Input name="pocEmail" type="email" defaultValue={account.pocEmail ?? ''} placeholder="jane@mybusiness.com" />
                </Field>
              </FieldRow>
            </CardContent>
          </Card>

          {/* ── Delivery Preferences ─────────────────────── */}
          <Card>
            <CardHeader><SectionTitle icon={Truck}>Delivery Preferences</SectionTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Preferred Delivery Days">
                <div className="flex flex-wrap gap-2 pt-1">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedDays.includes(day)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Preferred Delivery Times / Notes">
                <Input
                  name="preferredDeliveryTimes"
                  defaultValue={account.preferredDeliveryTimes ?? ''}
                  placeholder="e.g. Before 2pm, mornings preferred"
                />
              </Field>
            </CardContent>
          </Card>

          {/* ── Additional Locations ─────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <SectionTitle icon={MapPin}>Additional Locations</SectionTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLocation} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Location
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {extraLocations.length === 0 && (
                <p className="text-sm text-muted-foreground">No additional locations. Click "Add Location" if you have multiple sites.</p>
              )}
              {extraLocations.map((loc, i) => (
                <div key={i} className="space-y-3 border rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">Location {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeLocation(i)}
                      className="text-muted-foreground hover:text-red-600 transition-colors"
                      aria-label="Remove location"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <Field label="Address">
                    <Input
                      value={loc.address}
                      onChange={e => updateLocation(i, 'address', e.target.value)}
                      placeholder="456 Oak Ave"
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="City">
                      <Input value={loc.city} onChange={e => updateLocation(i, 'city', e.target.value)} placeholder="City" />
                    </Field>
                    <Field label="State">
                      <Input value={loc.state} onChange={e => updateLocation(i, 'state', e.target.value)} placeholder="DC" maxLength={2} />
                    </Field>
                    <Field label="ZIP">
                      <Input value={loc.zip} onChange={e => updateLocation(i, 'zip', e.target.value)} placeholder="20001" />
                    </Field>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Account Standing (read-only) ──────────────── */}
          <Card>
            <CardHeader><SectionTitle icon={CreditCard}>Account Standing</SectionTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Credit Limit</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(account.creditLimit ?? '0')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Balance</p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(account.balance ?? '0')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Terms</p>
                  <Badge variant="secondary">{account.paymentTerms ?? 'NET30'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="pb-6">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Saving…' : 'Save Profile'}
        </Button>
      </div>
    </form>
  )
}
