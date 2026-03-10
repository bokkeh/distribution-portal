import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createUser } from '@/actions/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const allRoles = [
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff / Sales Rep' },
  { value: 'driver', label: 'Driver' },
  { value: 'customer', label: 'Customer' },
]

export default function NewUserPage() {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add User</h1>
          <p className="text-muted-foreground mt-1">Create a new portal account</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createUser} className="space-y-4">
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

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Customer Account Fields (used if customer role is selected)</p>
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
                    <option value="NET30">NET30</option>
                    <option value="NET15">NET15</option>
                    <option value="COD">COD</option>
                    <option value="PREPAID">Prepaid</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Create User</Button>
              <Link href="/admin/users"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
