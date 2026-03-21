'use client'

import { useState, useTransition } from 'react'
import { assignAccountToRep } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, X, Loader2 } from 'lucide-react'
import type { CustomerAccount } from '@/db/schema'

interface Props {
  memberId: string
  accounts: CustomerAccount[]
}

export function AccountAssignmentPanel({ memberId, accounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [removing, setRemoving] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUnassign(customerId: string) {
    setRemoving(customerId)
    startTransition(async () => {
      await assignAccountToRep(customerId, null)
      setAccounts(prev => prev.filter(a => a.id !== customerId))
      setRemoving(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          Assigned Accounts ({accounts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No accounts assigned.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div>
                  <p className="font-medium text-slate-800">{a.companyName}</p>
                  {(a.city || a.state) && (
                    <p className="text-xs text-slate-400">{[a.city, a.state].filter(Boolean).join(', ')}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-red-500"
                  onClick={() => handleUnassign(a.id)}
                  disabled={removing === a.id || isPending}
                >
                  {removing === a.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t">
          <a
            href={`/admin/crm?assignTo=${memberId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Assign accounts from CRM →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
