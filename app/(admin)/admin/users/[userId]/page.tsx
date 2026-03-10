import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts, drivers, users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRoleForm } from './user-role-form'

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) notFound()

  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.userId, user.id))
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id))

  return (
    <div className="p-4 sm:p-8 space-y-6">
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

        <UserRoleForm
          user={{ id: user.id, role: user.role, roles: user.roles, phone: user.phone, active: user.active }}
          accountId={account?.id}
        />

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
