'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateCustomerAccount } from '@/actions/crm'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import { DocumentUploadField } from '@/components/shared/DocumentUploadField'

type Account = {
  id: string
  assignedSalesRepId?: string | null
  companyName: string
  contactName: string | null
  address: string | null
  city: string | null
  state: string | null
  county?: string | null
  zip: string | null
  phone: string | null
  email: string | null
  businessEmail?: string | null
  businessPhone?: string | null
  pocName?: string | null
  pocPhone?: string | null
  pocEmail?: string | null
  hoursOfOperation?: string | null
  website?: string | null
  dcAbraNumber: string | null
  businessType?: string | null
  creditLimit: string | null
  paymentTerms: string | null
  hubspotCompanyId?: string | null
  liquorLicenseNumber?: string | null
  liquorLicenseState?: string | null
  liquorLicenseExpiration?: string | null
  liquorLicenseUrl?: string | null
}

type SalesLeadOption = {
  id: string
  name: string
}

export function AccountEditForm({
  account,
  mode,
  salesLeadOptions = [],
}: {
  account: Account
  mode: 'admin' | 'staff'
  salesLeadOptions?: SalesLeadOption[]
}) {
  const router = useRouter()
  const backPath = `/${mode}/crm/${account.id}`
  const formRef = useRef<HTMLFormElement | null>(null)
  const [state, action, pending] = useActionState(updateCustomerAccount, null)
  const { statusText, clearDraft } = useFormDraftAutosave(formRef, `account-edit:${mode}:${account.id}`)
  const [licenseUrl, setLicenseUrl] = useState(account.liquorLicenseUrl ?? '')

  useEffect(() => {
    if (!state) return
    if (state.error) {
      toast.error('Failed to save account', { description: state.error })
      return
    }
    clearDraft()
    toast.success('Account saved', {
      description: state.changedFields?.length ? `${state.changedFields.length} field(s) updated.` : 'Changes applied.',
    })
    router.refresh()
  }, [clearDraft, router, state])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="id" value={account.id} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="hubspotCompanyId" value={account.hubspotCompanyId ?? ''} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-slate-900">Autosave draft</p>
          <p className="text-xs text-slate-500">{statusText || 'Changes save locally while you type.'}</p>
        </div>
        <div className="text-xs text-slate-500">
          {pending ? 'Saving…' : state?.success ? 'Saved' : 'Ready'}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-companyName`}>Company Name</Label>
        <Input id={`${mode}-companyName`} name="companyName" defaultValue={account.companyName} required />
      </div>

      {mode === 'admin' ? (
        <div className="space-y-2">
          <Label htmlFor={`${mode}-assignedSalesRepId`}>Sales Lead</Label>
          <select
            id={`${mode}-assignedSalesRepId`}
            name="assignedSalesRepId"
            defaultValue={account.assignedSalesRepId ?? ''}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Unassigned</option>
            {salesLeadOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">Admins can assign a sales lead directly from the CRM settings tab.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-contactName`}>Account Contact</Label>
          <Input id={`${mode}-contactName`} name="contactName" defaultValue={account.contactName ?? ''} placeholder="Primary account owner" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-phone`}>Main Phone</Label>
          <Input id={`${mode}-phone`} name="phone" defaultValue={account.phone ?? ''} placeholder="+1 (555) 000-0000" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-email`}>Main Email</Label>
          <Input id={`${mode}-email`} name="email" type="email" defaultValue={account.email ?? ''} placeholder="orders@account.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-businessEmail`}>Business Email</Label>
          <Input id={`${mode}-businessEmail`} name="businessEmail" type="email" defaultValue={account.businessEmail ?? ''} placeholder="billing@account.com" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-businessPhone`}>Business Phone</Label>
          <Input id={`${mode}-businessPhone`} name="businessPhone" defaultValue={account.businessPhone ?? ''} placeholder="+1 (555) 000-0000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-hoursOfOperation`}>Hours of Operation</Label>
          <Input id={`${mode}-hoursOfOperation`} name="hoursOfOperation" defaultValue={account.hoursOfOperation ?? ''} placeholder="Mon-Fri 9am-6pm" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-website`}>Website</Label>
        <Input id={`${mode}-website`} name="website" type="url" defaultValue={account.website ?? ''} placeholder="https://example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-address`}>Address</Label>
        <AddressAutocomplete
          id={`${mode}-address`}
          name="address"
          defaultValue={account.address ?? ''}
          placeholder="123 Main St — start typing to search"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-city`}>City</Label>
          <Input id={`${mode}-city`} name="city" defaultValue={account.city ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-state`}>State</Label>
          <Input id={`${mode}-state`} name="state" defaultValue={account.state ?? ''} maxLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-county`}>County</Label>
          <Input id={`${mode}-county`} name="county" defaultValue={account.county ?? ''} placeholder="Montgomery" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-zip`}>ZIP</Label>
          <Input id={`${mode}-zip`} name="zip" defaultValue={account.zip ?? ''} />
        </div>
      </div>

      <div id="poc-fields" className="grid grid-cols-1 gap-4 scroll-mt-24 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-pocName`}>POC Name</Label>
          <Input id={`${mode}-pocName`} name="pocName" defaultValue={account.pocName ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-pocPhone`}>POC Phone</Label>
          <Input id={`${mode}-pocPhone`} name="pocPhone" defaultValue={account.pocPhone ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-pocEmail`}>POC Email</Label>
          <Input id={`${mode}-pocEmail`} name="pocEmail" type="email" defaultValue={account.pocEmail ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-businessType`}>Business Type</Label>
          <select
            id={`${mode}-businessType`}
            name="businessType"
            defaultValue={account.businessType ?? ''}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— Select type —</option>
            <option value="Liquor Store">Liquor Store</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Restaurant Group">Restaurant Group</option>
            <option value="Hotel">Hotel</option>
            <option value="Hotel Group">Hotel Group</option>
            <option value="Venue">Venue</option>
            <option value="Bar">Bar</option>
            <option value="Night Club">Night Club</option>
            <option value="Grocery Store">Grocery Store</option>
            <option value="Convenience Store">Convenience Store</option>
            <option value="Country Club">Country Club</option>
            <option value="Casino">Casino</option>
            <option value="Wholesaler">Wholesaler</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-dcAbraNumber`}>DC ABRA Number</Label>
          <Input id={`${mode}-dcAbraNumber`} name="dcAbraNumber" defaultValue={account.dcAbraNumber ?? ''} />
        </div>
      </div>

      <div id="license-fields" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 scroll-mt-24">
        <p className="text-sm font-semibold text-slate-800">Liquor License</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-liquorLicenseNumber`}>License Number</Label>
            <Input id={`${mode}-liquorLicenseNumber`} name="liquorLicenseNumber" defaultValue={account.liquorLicenseNumber ?? ''} placeholder="ABC-123456" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-liquorLicenseState`}>Issuing State</Label>
            <Input id={`${mode}-liquorLicenseState`} name="liquorLicenseState" defaultValue={account.liquorLicenseState ?? ''} maxLength={2} placeholder="DC" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-liquorLicenseExpiration`}>Expiration Date</Label>
            <Input id={`${mode}-liquorLicenseExpiration`} name="liquorLicenseExpiration" type="date" defaultValue={account.liquorLicenseExpiration ?? ''} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>License Document</Label>
          <input type="hidden" name="liquorLicenseUrl" value={licenseUrl} />
          <DocumentUploadField
            name={`license-${account.id}`}
            value={licenseUrl}
            onChange={setLicenseUrl}
            label="Upload license image or PDF"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-creditLimit`}>Credit Limit</Label>
          <Input id={`${mode}-creditLimit`} name="creditLimit" type="number" step="0.01" min="0" defaultValue={account.creditLimit ?? '0'} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-paymentTerms`}>Payment Terms</Label>
          <select id={`${mode}-paymentTerms`} name="paymentTerms" defaultValue={account.paymentTerms ?? 'PREPAID'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
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

      {state?.success ? (
        <p className="text-sm text-emerald-700">Account changes saved successfully.</p>
      ) : null}
      {state?.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save Account'}</Button>
        <Link href={backPath} className={buttonVariants({ variant: 'outline' })}>Cancel</Link>
      </div>
    </form>
  )
}
