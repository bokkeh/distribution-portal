import { db } from '@/db'
import { users, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { updateProfile } from '@/actions/profile'
import { User, MapPin, CreditCard } from 'lucide-react'

export default async function CustomerProfilePage() {
  const session = await requireRole('customer')

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.userId, session.user.id))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account information</p>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-4 h-4" />Personal Information</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProfile} className="space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input name="name" defaultValue={user.name} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={user.email} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" type="tel" defaultValue={user.phone ?? ''} />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Company Info (read-only) */}
      {account && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" />Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-muted-foreground">Company</p><p className="font-medium">{account.companyName}</p></div>
              <div><p className="text-muted-foreground">Payment Terms</p><Badge variant="secondary">{account.paymentTerms}</Badge></div>
            </div>
            {account.contactName && (
              <div>
                <p className="text-muted-foreground">Person of Contact</p>
                <p className="font-medium">{account.contactName}</p>
              </div>
            )}
            {account.state === 'DC' && account.dcAbraNumber && (
              <div>
                <p className="text-muted-foreground">DC ABRA Number</p>
                <p className="font-medium">{account.dcAbraNumber}</p>
              </div>
            )}
            {account.address && (
              <div>
                <p className="text-muted-foreground">Address</p>
                <p className="font-medium">{account.address}</p>
                <p className="text-muted-foreground">{[account.city, account.state, account.zip].filter(Boolean).join(', ')}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              To update company information, contact your AHAWC account representative.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Account Standing */}
      {account && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Account Standing</CardTitle></CardHeader>
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
