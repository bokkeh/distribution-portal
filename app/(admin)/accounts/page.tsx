import { db } from '@/db'
import { chartOfAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, BookOpen } from 'lucide-react'

const typeColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  asset: 'success',
  liability: 'destructive',
  equity: 'info',
  revenue: 'default',
  expense: 'warning',
}

export default async function ChartOfAccountsPage() {
  const accounts = await db.select().from(chartOfAccounts).orderBy(chartOfAccounts.accountNumber)

  const grouped = accounts.reduce((acc, account) => {
    if (!acc[account.type]) acc[account.type] = []
    acc[account.type].push(account)
    return acc
  }, {} as Record<string, typeof accounts>)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">Double-entry bookkeeping accounts</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/accounts/journal">
            <Button variant="outline"><BookOpen className="w-4 h-4 mr-2" />Journal Entries</Button>
          </Link>
          <Link href="/admin/accounts/journal/new">
            <Button><Plus className="w-4 h-4 mr-2" />New Entry</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(['asset', 'liability', 'equity', 'revenue', 'expense'] as const).map(type => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                {type}s
                <Badge variant={typeColors[type]}>{grouped[type]?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(grouped[type] ?? []).map(account => (
                  <div key={account.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <span className="text-xs text-muted-foreground mr-2">{account.accountNumber}</span>
                      <span className="text-sm font-medium">{account.accountName}</span>
                    </div>
                    {!account.active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                ))}
                {(!grouped[type] || grouped[type].length === 0) && (
                  <p className="text-sm text-muted-foreground py-2">No accounts</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
