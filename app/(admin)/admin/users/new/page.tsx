import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateUserForm } from '@/components/users/CreateUserForm'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { asc, isNull } from 'drizzle-orm'

export default async function NewUserPage() {
  const availableCustomerAccounts = await db
    .select({ id: customerAccounts.id, companyName: customerAccounts.companyName, email: customerAccounts.email })
    .from(customerAccounts)
    .where(isNull(customerAccounts.userId))
    .orderBy(asc(customerAccounts.companyName))
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add User</h1>
          <p className="text-muted-foreground mt-1">Create a new portal account</p>
        </div>
      </div>

      <div className="max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-medium">Need the public taster signup link handy?</p>
        <p className="mt-1 text-sky-900">
          Share{' '}
          <Link href="/taster-signup" className="font-semibold underline underline-offset-4">
            /taster-signup
          </Link>{' '}
          for invite-code based taster registration. Admin-created users can still log in directly with the temporary password you set here.
        </p>
      </div>

      <CreateUserForm availableCustomerAccounts={availableCustomerAccounts} />
    </div>
  )
}
