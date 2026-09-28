import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { MemberProfileView } from '@/components/progression/MemberProfileView'

export default async function MySalesProgressionPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const isSalesManager = (session.user.roles ?? [session.user.role]).includes('sales_manager')

  return (
    <div className="space-y-4">
      {isSalesManager && (
        <div className="flex justify-end">
          <Link href="/sales/team/roster" className="text-sm font-medium text-blue-600 hover:underline">View team roster →</Link>
        </div>
      )}
      <MemberProfileView userId={session.user.id} />
    </div>
  )
}
