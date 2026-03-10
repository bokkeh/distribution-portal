import { db } from '@/db'
import { users, customerAccounts, drivers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { activateUser, deactivateUser, updateUserRole } from '@/actions/users'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function UserDetailPage({ params }: { params: { userId: string } }) {
  const [user] = await db.select().from(users).where(eq(users.id, params.userId))
  if (!user) notFound()

  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.userId, user.id))
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id))

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
          <p className="text-muted-foreground mt-1">{user.email}</p>
        </div>
        <Badge variant={user.active ? 'success' : 'secondary'}>{user.active ? 'Active' : 'Inactive'}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>User Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-muted-foreground">Name</p><p className="font-medium">{user.name}</p></div>
              <div><p className="text-muted-foreground">Role</p><Badge variant="outline" className="capitalize">{user.role}</Badge></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium">{user.email}</p></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{user.phone ?? '—'}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form action={updateUserRole} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <Label htmlFor="role">Role</Label>
              <div className="flex gap-2">
                <select
                  id="role"
                  name="role"
                  defaultValue={user.role}
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="driver">Driver</option>
                  <option value="customer">Customer</option>
                </select>
                <Button type="submit" variant="outline">Save Role</Button>
              </div>
            </form>
            {user.active ? (
              <form action={deactivateUser.bind(null, user.id)}>
                <Button variant="destructive" className="w-full" type="submit">Deactivate Account</Button>
              </form>
            ) : (
              <form action={activateUser.bind(null, user.id)}>
                <Button className="w-full" type="submit">Reactivate Account</Button>
              </form>
            )}
            {account && (
              <Link href={`/admin/crm/${account.id}`}>
                <Button variant="outline" className="w-full">View CRM Account</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {account && (
          <Card>
            <CardHeader><CardTitle>Customer Account</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Company</p><p className="font-medium">{account.companyName}</p></div>
                <div><p className="text-muted-foreground">Terms</p><Badge variant="secondary">{account.paymentTerms}</Badge></div>
                <div><p className="text-muted-foreground">Credit Limit</p><p className="font-medium">${account.creditLimit}</p></div>
                <div><p className="text-muted-foreground">Balance</p><p className="font-medium">${account.balance}</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {driver && (
          <Card>
            <CardHeader><CardTitle>Driver Profile</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium">{[driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ') || '—'}</p></div>
                <div><p className="text-muted-foreground">License Plate</p><p className="font-medium">{driver.licensePlate ?? '—'}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{driver.phone}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={driver.active ? 'success' : 'secondary'}>{driver.active ? 'Active' : 'Inactive'}</Badge></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
