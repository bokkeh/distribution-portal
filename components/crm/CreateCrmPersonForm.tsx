'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createCrmPerson } from '@/actions/crm-people'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateCrmPersonForm({ accounts }: { accounts: Array<{ id: string; companyName: string }> }) {
  const router = useRouter()
  const [kind, setKind] = useState<'company' | 'community'>('company')
  const [state, action, pending] = useActionState(createCrmPerson, null)

  useEffect(() => {
    if (!state?.success) return
    toast.success(state.kind === 'company' ? 'Company contact added' : 'Community member added')
    router.push(`/admin/crm?tab=${state.kind === 'company' ? 'company-contacts' : 'community-contacts'}`)
  }, [router, state])

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-900">Person type</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['company', 'community'] as const).map((value) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 transition ${kind === value ? 'border-[#ff5a00] bg-orange-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              <span className="font-semibold text-slate-900">{value === 'company' ? 'Company contact' : 'Community member'}</span>
              <span className="mt-1 block text-xs text-slate-500">{value === 'company' ? 'Associated with a CRM account' : 'Subscribed to brand news'}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind === 'company' ? (
        <div className="space-y-2">
          <Label htmlFor="person-account">Company account</Label>
          <select id="person-account" name="customerId" required className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
            <option value="">Select an account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.companyName}</option>)}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="person-first-name">First name</Label><Input id="person-first-name" name="firstName" required autoComplete="given-name" /></div>
        <div className="space-y-2"><Label htmlFor="person-last-name">Last name</Label><Input id="person-last-name" name="lastName" required autoComplete="family-name" /></div>
        <div className="space-y-2"><Label htmlFor="person-email">Email</Label><Input id="person-email" name="email" type="email" required autoComplete="email" /></div>
        <div className="space-y-2"><Label htmlFor="person-phone">Phone number</Label><Input id="person-phone" name="phone" type="tel" required autoComplete="tel" /></div>
      </div>

      {state?.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add person'}</Button>
    </form>
  )
}
