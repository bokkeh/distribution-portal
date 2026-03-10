import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Building2 } from 'lucide-react'

export default async function StaffCRMPage() {
  const accounts = await db.select().from(customerAccounts).orderBy(customerAccounts.companyName)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Accounts</h1>
        <p className="text-muted-foreground mt-1">{accounts.length} accounts</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Company</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Location</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Terms</th>
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
                  <td className="px-6 py-4 text-sm text-muted-foreground">{[a.city, a.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-6 py-4"><Badge variant="secondary">{a.paymentTerms}</Badge></td>
                  <td className="px-6 py-4 text-sm font-medium">{formatCurrency(a.balance ?? '0')}</td>
                  <td className="px-6 py-4"><Link href={`/staff/crm/${a.id}`}><Button variant="ghost" size="sm">View</Button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
