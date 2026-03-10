import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { activateUser, deactivateUser, updateUserRole } from '@/actions/users'
import { db } from '@/db'
import { customerAccounts, drivers, users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const allRoles = ['admin', 'staff', 'driver', 'customer'] as const

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>User Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-muted-foreground">Name</p><p className="font-medium">{user.name}</p></div>
              <div><p className="text-muted-foreground">Primary Role</p><Badge variant="outline" className="capitalize">{user.role}</Badge></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium">{user.email}</p></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{user.phone ?? '-'}</p></div>
            </div>
            <div>
              <p className="mb-2 text-muted-foreground">All Roles</p>
              <div className="flex flex-wrap gap-2">
                {user.roles.map(role => <Badge key={role} variant="secondary" className="capitalize">{role}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form action={updateUserRole} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="phone" value={user.phone ?? ''} />
              <Label htmlFor="role">Primary Role</Label>
              <div className="flex gap-2">
                <select
                  id="role"
                  name="role"
                  defaultValue={user.role}
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {allRoles.map(role => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}
                </select>
                <Button type="submit" variant="outline">Save Roles</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3 text-sm">
                {allRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 capitalize">
                    <input type="checkbox" name="roles" value={role} defaultChecked={user.roles.includes(role)} className="rounded" />
                    {role}
                  </label>
                ))}
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

            {account ? (
              <Link href={`/admin/crm/${account.id}`}>
                <Button variant="outline" className="w-full">View CRM Account</Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>

        {account ? (
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
        ) : null}

        {driver ? (
          <Card>
            <CardHeader><CardTitle>Driver Profile</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium">{[driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ') || '-'}</p></div>
                <div><p className="text-muted-foreground">License Plate</p><p className="font-medium">{driver.licensePlate ?? '-'}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{driver.phone}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={driver.active ? 'success' : 'secondary'}>{driver.active ? 'Active' : 'Inactive'}</Badge></div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
