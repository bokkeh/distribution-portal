import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { DealStageSelect } from '@/components/crm/DealStageSelect'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import Link from 'next/link'
import { Building2, LayoutList, Kanban } from 'lucide-react'

export default async function StaffCRMPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const isPipeline = view === 'pipeline'

  const accounts = await db.select().from(customerAccounts).orderBy(customerAccounts.companyName)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Accounts</h1>
          <p className="text-muted-foreground mt-1">{accounts.length} accounts</p>
        </div>
        <div className="flex items-center gap-2 border rounded-lg p-1 bg-slate-50">
          <Link href="/staff/crm">
            <Button variant={!isPipeline ? 'default' : 'ghost'} size="sm" className="gap-1.5">
              <LayoutList className="w-4 h-4" />
              List
            </Button>
          </Link>
          <Link href="/staff/crm?view=pipeline">
            <Button variant={isPipeline ? 'default' : 'ghost'} size="sm" className="gap-1.5">
              <Kanban className="w-4 h-4" />
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {isPipeline ? (
        <PipelineBoard accounts={accounts} basePath="/staff/crm" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Location</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Stage</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Balance</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.companyName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {[a.city, a.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <DealStageSelect accountId={a.id} currentStage={a.dealStage} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{formatCurrency(a.balance ?? '0')}</td>
                    <td className="px-6 py-4">
                      <Link href={`/staff/crm/${a.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
