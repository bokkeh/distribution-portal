import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, MapPin, Phone, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { PhoneActions } from '@/components/shared/PhoneActions'
import { getReorderFollowUps, LOW_INVENTORY_CASE_THRESHOLD, SINGLE_CASE_REORDER_DELAY_DAYS } from '@/lib/sales/reorder-follow-ups'

export default async function SalesAccountsPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const isAdmin = session.user.roles?.includes('admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  // Admins without a sales member profile see all accounts
  const accounts = member
    ? await db.select().from(customerAccounts).where(eq(customerAccounts.assignedSalesRepId, member.id))
    : isAdmin
      ? await db.select().from(customerAccounts)
      : []

  if (!member && !isAdmin) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
      </div>
    )
  }

  const now = new Date()
  const reorderSuggestions = (await getReorderFollowUps(accounts)).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{member ? 'My Accounts' : 'All Accounts'}</h1>
          <p className="text-slate-500 mt-1">{accounts.length} {member ? 'accounts assigned to you' : 'total accounts'}</p>
        </div>
      </div>

      {/* Reorder suggestions */}
      {reorderSuggestions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Reorder Follow-ups ({reorderSuggestions.length})
            </CardTitle>
            <p className="text-xs text-amber-700">
              Triggered when tracked inventory falls to {LOW_INVENTORY_CASE_THRESHOLD} case left, or after {SINGLE_CASE_REORDER_DELAY_DAYS} days for a 1-case order.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {reorderSuggestions.map((followUp) => {
                return (
                  <Link key={followUp.accountId} href={`/sales/accounts/${followUp.accountId}`}>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2.5 hover:bg-amber-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{followUp.companyName}</p>
                        <p className="text-xs text-slate-500">{followUp.reason}</p>
                      </div>
                      <span className="text-xs text-amber-700 font-medium shrink-0">
                        {followUp.daysSinceLastOrder == null ? 'Inventory trigger' : `${followUp.daysSinceLastOrder}d ago`}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
