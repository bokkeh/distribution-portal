import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, MapPin, Phone, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { PhoneActions } from '@/components/shared/PhoneActions'

export default async function SalesAccountsPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  if (!member) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
      </div>
    )
  }

  const accounts = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, member.id))

  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Accounts</h1>
          <p className="text-slate-500 mt-1">{accounts.length} accounts assigned to you</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No accounts assigned yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(account => {
            const isOverdue = account.nextRequiredVisitDate && new Date(account.nextRequiredVisitDate) < now
            const isDueSoon = !isOverdue && account.nextRequiredVisitDate && (() => {
              const daysUntil = Math.ceil((new Date(account.nextRequiredVisitDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return daysUntil <= 7
            })()

            return (
              <Link key={account.id} href={`/sales/accounts/${account.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{account.companyName}</p>
                        {account.contactName && (
                          <p className="text-sm text-slate-500">{account.contactName}</p>
                        )}
                      </div>
                      {isOverdue ? (
                        <Badge variant="destructive" className="text-xs shrink-0">Overdue</Badge>
                      ) : isDueSoon ? (
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 shrink-0">Due Soon</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300 shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Current
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {(account.city || account.state) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          {[account.city, account.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {account.phone && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                          <Phone className="w-3 h-3 mt-1.5 shrink-0" />
                          <PhoneActions phone={account.phone} name={account.companyName} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      {account.accountPriority && (
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            account.accountPriority === 'high' ? 'text-red-700 border-red-200' :
                            account.accountPriority === 'medium' ? 'text-blue-700 border-blue-200' :
                            'text-slate-500 border-slate-200'
                          }`}
                        >
                          {account.accountPriority}
                        </Badge>
                      )}
                      {account.accountType && (
                        <Badge variant="outline" className="text-xs text-slate-600 capitalize">
                          {account.accountType.replace('_', ' ')}
                        </Badge>
                      )}
                      {account.lastVisitDate && (
                        <span className="text-xs text-slate-400 ml-auto">
                          Last: {new Date(account.lastVisitDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
