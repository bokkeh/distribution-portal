import Link from 'next/link'
import Image from 'next/image'
import { Plus, User } from 'lucide-react'
import { db } from '@/db'
import { users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getUserAccessSummaryMap } from '@/lib/auth/activity'
import { formatDate } from '@/lib/utils'

const roleColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  admin: 'destructive',
  staff: 'info',
  driver: 'warning',
  customer: 'success',
  taster: 'warning',
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(typeof value === 'string' ? new Date(value) : value)
}

export default async function UsersPage() {
  const accessSummaryMap = await getUserAccessSummaryMap()
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    roles: users.roles,
    phone: users.phone,
    avatarUrl: users.avatarUrl,
    active: users.active,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.role, users.name)

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="mt-1 text-muted-foreground">{allUsers.length} total team members and portal users</p>
        </div>
        <Link href="/admin/users/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add User</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Roles</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent Access</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Joined</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {allUsers.map((user) => {
                  const access = accessSummaryMap.get(user.id)

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                            {user.avatarUrl ? (
                              <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => <Badge key={role} variant={roleColors[role]}>{role}</Badge>)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{user.phone || '-'}</td>
                      <td className="px-6 py-4">
                        {user.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="space-y-1">
                          <p className="font-medium">{access?.lastLoginAt ? formatDateTime(access.lastLoginAt) : 'No login yet'}</p>
                          <p className="text-xs text-muted-foreground">
                            Last logout: {access?.lastLogoutAt ? formatDateTime(access.lastLogoutAt) : '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
