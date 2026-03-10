'use client'

import Link from 'next/link'
import { DEAL_STAGES, getDealStage } from '@/lib/deal-stages'
import { DealStageSelect } from './DealStageSelect'
import { formatCurrency } from '@/lib/utils'

interface Account {
  id: string
  companyName: string
  dealStage: string | null
  city: string | null
  state: string | null
  balance: string | null
  contactName: string | null
}

interface Props {
  accounts: Account[]
  basePath: string // '/staff/crm' or '/admin/crm'
}

export function PipelineBoard({ accounts, basePath }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {DEAL_STAGES.map(stage => {
        const stageAccounts = accounts.filter(a => (a.dealStage ?? 'new_lead') === stage.value)
        return (
          <div key={stage.value} className="flex-shrink-0 w-64">
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${stage.color}`}>
              <span className="text-xs font-semibold uppercase tracking-wide">{stage.label}</span>
              <span className="text-xs font-bold">{stageAccounts.length}</span>
            </div>

            {/* Cards */}
            <div className="space-y-2 mt-2 min-h-24">
              {stageAccounts.map(account => (
                <div
                  key={account.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2"
                >
                  <Link
                    href={`${basePath}/${account.id}`}
                    className="block text-sm font-semibold text-slate-900 hover:text-blue-600 leading-tight"
                  >
                    {account.companyName}
                  </Link>
                  {(account.city || account.state) && (
                    <p className="text-xs text-muted-foreground">
                      {[account.city, account.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {account.balance && parseFloat(account.balance) > 0 && (
                    <p className="text-xs text-slate-500">
                      Balance: <span className="font-medium text-slate-700">{formatCurrency(account.balance)}</span>
                    </p>
                  )}
                  <DealStageSelect
                    accountId={account.id}
                    currentStage={account.dealStage}
                    size="sm"
                  />
                </div>
              ))}
              {stageAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No accounts</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
