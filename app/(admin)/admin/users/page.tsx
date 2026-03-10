import Link from 'next/link'
import { Plus, User } from 'lucide-react'
import { db } from '@/db'
import { users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

const roleColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  admin: 'destructive',
  staff: 'info',
  driver: 'warning',
  customer: 'success',
}

export default async function UsersPage() {
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    roles: users.roles,
    phone: users.phone,
    active: users.active,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.role, users.name)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-muted-foreground mt-1">{allUsers.length} total users</p>
        </div>
        <Link href="/admin/users/new">
          <Button><Plus className="w-4 h-4 mr-2" />Add User</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Roles</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {allUsers.map(user => (
                <tr key={user.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => <Badge key={role} variant={roleColors[role]}>{role}</Badge>)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{user.phone || '-'}</td>
                  <td className="px-6 py-4">
                    {user.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/users/${user.id}`}>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
