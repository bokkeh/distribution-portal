import { updateCustomerAccount } from '@/actions/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Account = {
  id: string
  companyName: string
  contactName: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email: string | null
  businessEmail?: string | null
  businessPhone?: string | null
  pocName?: string | null
  pocPhone?: string | null
  pocEmail?: string | null
  hoursOfOperation?: string | null
  dcAbraNumber: string | null
  creditLimit: string | null
  paymentTerms: string | null
  hubspotCompanyId?: string | null
}

export function AccountEditForm({ account, mode }: { account: Account; mode: 'admin' | 'staff' }) {
  const backPath = `/${mode}/crm/${account.id}`

  return (
    <form action={updateCustomerAccount} className="space-y-4">
      <input type="hidden" name="id" value={account.id} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="hubspotCompanyId" value={account.hubspotCompanyId ?? ''} />

      <div className="space-y-2">
        <Label htmlFor={`${mode}-companyName`}>Company Name</Label>
        <Input id={`${mode}-companyName`} name="companyName" defaultValue={account.companyName} required />
      </div>

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
        <Label htmlFor={`${mode}-address`}>Address</Label>
        <Input id={`${mode}-address`} name="address" defaultValue={account.address ?? ''} placeholder="123 Main St" />
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
          <Label htmlFor={`${mode}-zip`}>ZIP</Label>
          <Input id={`${mode}-zip`} name="zip" defaultValue={account.zip ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-dcAbraNumber`}>DC ABRA Number</Label>
          <Input id={`${mode}-dcAbraNumber`} name="dcAbraNumber" defaultValue={account.dcAbraNumber ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-creditLimit`}>Credit Limit</Label>
          <Input id={`${mode}-creditLimit`} name="creditLimit" type="number" step="0.01" min="0" defaultValue={account.creditLimit ?? '0'} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-paymentTerms`}>Payment Terms</Label>
          <select id={`${mode}-paymentTerms`} name="paymentTerms" defaultValue={account.paymentTerms ?? 'NET30'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="NET30">NET30</option>
            <option value="NET15">NET15</option>
            <option value="COD">COD</option>
            <option value="PREPAID">PREPAID</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit">Save Account</Button>
        <a href={backPath}><Button type="button" variant="outline">Cancel</Button></a>
      </div>
    </form>
  )
}
