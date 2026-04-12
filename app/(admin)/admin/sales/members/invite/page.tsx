import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { SalesRepInviteForm } from '@/components/sales/SalesRepInviteForm'

export default async function InviteSalesRepPage() {
  await requireAdmin()

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/sales/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invite Sales Rep</h1>
          <p className="mt-1 text-sm text-slate-500">Send a one-time signup link for a new sales rep account.</p>
        </div>
      </div>

      <SalesRepInviteForm />
    </div>
  )
}
