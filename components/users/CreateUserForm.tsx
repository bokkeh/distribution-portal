'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createUser, sendUserWelcomeEmail } from '@/actions/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ALL_FEATURES } from '@/lib/users/features'

const allRoles = [
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'driver', label: 'Driver' },
  { value: 'taster', label: 'Taster' },
  { value: 'customer', label: 'Customer' },
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'sales_manager', label: 'Sales Manager' },
]

function SendWelcomeEmailButton({ name, email, password, roleLabel }: { name: string; email: string; password: string; roleLabel: string }) {
  const [state, action, pending] = useActionState(sendUserWelcomeEmail, null)

  useEffect(() => {
    if (state?.error) toast.error('Failed to send email', { description: state.error })
    else if (state?.success) toast.success('Login email sent')
  }, [state])

  return (
    <form action={action}>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="roleLabel" value={roleLabel} />
      <Button type="submit" disabled={pending || state?.success}>
        {pending ? 'Sending...' : state?.success ? 'Email sent' : 'Email login details to user'}
      </Button>
    </form>
  )
}

export function CreateUserForm({
  availableCustomerAccounts,
}: {
  availableCustomerAccounts: Array<{ id: string; companyName: string; email: string | null }>
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createUser, null)

  useEffect(() => {
    if (state?.error) toast.error('Failed to create user', { description: state.error })
  }, [state])

  if (state?.success) {
    return (
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>User created</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            <strong>{state.name}</strong> ({state.email}) can now log in as {state.roleLabel}.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-slate-700">
              Send them their login email and temporary password now, or share the password shown below yourself. This password cannot be retrieved again later — only reset.
            </p>
            <Input readOnly value={state.password} className="mt-3 bg-white font-mono" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SendWelcomeEmailButton name={state.name!} email={state.email!} password={state.password!} roleLabel={state.roleLabel!} />
            <Button type="button" variant="outline" onClick={() => router.push('/admin/users')}>
              Done — go to users
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input name="name" id="name" required placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Primary Role</Label>
              <select name="role" id="role" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select role...</option>
                {allRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>All Roles</Label>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3 text-sm">
              {allRoles.map(role => (
                <label key={role.value} className="flex items-center gap-2">
                  <input type="checkbox" name="roles" value={role.value} className="rounded" />
                  {role.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">The primary role will always be included automatically.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input name="email" id="email" type="email" required placeholder="user@example.com" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input name="password" id="password" type="password" required placeholder="........" minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input name="phone" id="phone" type="tel" placeholder="555-0100" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Enabled Features</Label>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3 text-sm sm:grid-cols-3">
              {ALL_FEATURES.map(feature => (
                <label key={feature.key} className="flex items-center gap-2">
                  <input type="checkbox" name="features" value={feature.key} className="rounded" />
                  {feature.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Leave these unchecked to use the default feature set for the chosen roles.</p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Customer Account Fields (used if customer role is selected)</p>
            <div className="space-y-2">
              <Label htmlFor="existingCustomerAccountId">Link Existing CRM Account</Label>
              <select name="existingCustomerAccountId" id="existingCustomerAccountId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="">Create a new CRM account from the fields below</option>
                {availableCustomerAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.companyName}{account.email ? ` — ${account.email}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Choose this when the business already exists in CRM. This prevents a duplicate account.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input name="companyName" id="companyName" placeholder="ABC Liquors LLC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Person of Contact</Label>
              <Input name="contactName" id="contactName" placeholder="Jane Smith" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input name="address" id="address" placeholder="123 Main St" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input name="city" id="city" placeholder="Houston" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input name="state" id="state" placeholder="TX" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input name="zip" id="zip" placeholder="77001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dcAbraNumber">DC ABRA Number</Label>
                <Input name="dcAbraNumber" id="dcAbraNumber" placeholder="Required for DC stores" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Credit Limit ($)</Label>
                <Input name="creditLimit" id="creditLimit" type="number" step="0.01" min="0" placeholder="5000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <select name="paymentTerms" id="paymentTerms" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="PREPAID">Prepaid</option>
                  <option value="NET30">NET30</option>
                  <option value="NET15">NET15</option>
                  <option value="COD">COD</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create User'}</Button>
            <Link href="/admin/users"><Button type="button" variant="outline">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
