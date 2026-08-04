'use client'

import { useActionState } from 'react'
import { confirmRepAssistedCustomerDetails } from '@/actions/rep-assisted-orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RepAssistedCustomerConfirmation({ token, account }: { token: string; account: { email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null } }) {
  const action = confirmRepAssistedCustomerDetails.bind(null, token)
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" name="email" type="email" defaultValue={account.email ?? ''} />
        <Field label="Mobile number" name="phone" type="tel" defaultValue={account.phone ?? ''} />
        <Field label="Billing / delivery address" name="address" defaultValue={account.address ?? ''} />
        <Field label="City" name="city" defaultValue={account.city ?? ''} />
        <Field label="State" name="state" defaultValue={account.state ?? ''} />
        <Field label="ZIP" name="zip" defaultValue={account.zip ?? ''} />
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="termsAccepted" className="mt-1" required /><span>I confirm this account and delivery information is accurate and accept the applicable order and payment terms.</span></label>
      {state?.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      {state?.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Information confirmed. You can proceed to payment.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Confirming…' : 'Confirm information'}</Button>
    </form>
  )
}

function Field({ label, name, type = 'text', defaultValue }: { label: string; name: string; type?: string; defaultValue: string }) {
  return <div className="space-y-1"><Label htmlFor={`confirm-${name}`}>{label}</Label><Input id={`confirm-${name}`} name={name} type={type} defaultValue={defaultValue} required /></div>
}
