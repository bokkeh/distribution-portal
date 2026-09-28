import { requireAdminOrStaff } from '@/lib/auth/session'
import { getPromotionHistory } from '@/actions/progression'
import { PromotionHistoryList } from '@/components/progression/PromotionHistoryList'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default async function PromotionHistoryPage() {
  await requireAdminOrStaff()
  const rows = await getPromotionHistory()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promotion History</h1>
          <p className="mt-1 text-slate-500">Every rank change across the team — the audit trail for Team Progression.</p>
        </div>
        <a href="/api/progression/export/history">
          <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </a>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <PromotionHistoryList rows={rows} showMember />
      </div>
    </div>
  )
}
