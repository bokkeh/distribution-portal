'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createCustomerAccount } from '@/actions/crm'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateAccountForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createCustomerAccount, null)

  useEffect(() => {
    if (!state) return
    if (state.error) {
      toast.error('Failed to create account', { description: state.error })
      return
    }
    if (state.success && state.accountId) {
      toast.success('Account created')
      router.push(`/admin/crm/${state.accountId}`)
    }
  }, [router, state])

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-companyName">Company Name</Label>
        <Input id="new-companyName" name="companyName" required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-contactName">Account Contact</Label>
          <Input id="new-contactName" name="contactName" placeholder="Primary account owner" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-phone">Main Phone</Label>
          <Input id="new-phone" name="phone" placeholder="+1 (555) 000-0000" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-email">Main Email</Label>
          <Input id="new-email" name="email" type="email" placeholder="orders@account.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-businessEmail">Business Email</Label>
          <Input id="new-businessEmail" name="businessEmail" type="email" placeholder="billing@account.com" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-businessPhone">Business Phone</Label>
          <Input id="new-businessPhone" name="businessPhone" placeholder="+1 (555) 000-0000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-hoursOfOperation">Hours of Operation</Label>
          <Input id="new-hoursOfOperation" name="hoursOfOperation" placeholder="Mon-Fri 9am-6pm" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-address">Address</Label>
        <Input id="new-address" name="address" placeholder="123 Main St" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="new-city">City</Label>
          <Input id="new-city" name="city" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-state">State</Label>
          <Input id="new-state" name="state" maxLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-zip">ZIP</Label>
          <Input id="new-zip" name="zip" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="new-pocName">POC Name</Label>
          <Input id="new-pocName" name="pocName" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-pocPhone">POC Phone</Label>
          <Input id="new-pocPhone" name="pocPhone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-pocEmail">POC Email</Label>
          <Input id="new-pocEmail" name="pocEmail" type="email" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="new-dcAbraNumber">DC ABRA Number</Label>
          <Input id="new-dcAbraNumber" name="dcAbraNumber" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-creditLimit">Credit Limit</Label>
          <Input id="new-creditLimit" name="creditLimit" type="number" step="0.01" min="0" defaultValue="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-paymentTerms">Payment Terms</Label>
          <select id="new-paymentTerms" name="paymentTerms" defaultValue="NET30" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="PREPAID">Prepaid</option>
            <option value="DUE_ON_RECEIPT">Due on Receipt</option>
            <option value="NET7">Net 7</option>
            <option value="NET10">Net 10</option>
            <option value="NET15">Net 15</option>
            <option value="NET30">Net 30</option>
            <option value="NET45">Net 45</option>
            <option value="NET60">Net 60</option>
            <option value="NET90">Net 90</option>
            <option value="COD">COD (Cash on Delivery)</option>
            <option value="2/10_NET30">2/10 Net 30 (Early Pay Discount)</option>
          </select>
        </div>
      </div>

      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create Account'}</Button>
        <Link href="/admin/crm" className={buttonVariants({ variant: 'outline' })}>Cancel</Link>
      </div>
    </form>
  )
}
