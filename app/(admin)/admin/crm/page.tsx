import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { getHubSpotCompanies } from '@/lib/hubspot/client'
import { HubSpotCompaniesTab } from '@/components/crm/HubSpotCompaniesTab'
import { CRMTabs } from '@/components/crm/CRMTabs'
import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'

export default async function CRMPage() {
  const [accounts, hsCompanies] = await Promise.all([
    db.select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      city: customerAccounts.city,
      state: customerAccounts.state,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      creditLimit: customerAccounts.creditLimit,
      balance: customerAccounts.balance,
      paymentTerms: customerAccounts.paymentTerms,
      hubspotContactId: customerAccounts.hubspotContactId,
      hubspotCompanyId: customerAccounts.hubspotCompanyId,
    }).from(customerAccounts).orderBy(customerAccounts.companyName),
    getHubSpotCompanies(),
  ])

  // Set of HubSpot company IDs already imported into local accounts
  const importedHsIds = new Set(
    accounts.map(a => a.hubspotCompanyId).filter(Boolean) as string[]
  )

  const localAccountsTable = (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Terms</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Balance</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">HubSpot</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {accounts.length === 0 ? (
            <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No accounts yet. Import from HubSpot or add manually.</td></tr>
          ) : accounts.map(account => (
            <tr key={account.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{account.companyName}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {[account.city, account.state].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="px-6 py-4 text-sm">{account.email || account.phone || '—'}</td>
              <td className="px-6 py-4"><Badge variant="secondary">{account.paymentTerms}</Badge></td>
              <td className="px-6 py-4 text-sm font-medium">{formatCurrency(account.balance ?? '0')}</td>
              <td className="px-6 py-4">
                {account.hubspotCompanyId || account.hubspotContactId ? (
                  <Badge variant="success">Synced</Badge>
                ) : (
                  <Badge variant="outline">Not synced</Badge>
                )}
              </td>
              <td className="px-6 py-4">
                <Link href={`/admin/crm/${account.id}`}>
                  <Button variant="ghost" size="sm">View</Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM / Accounts</h1>
          <p className="text-muted-foreground mt-1">
            {accounts.length} local · {hsCompanies.length} in HubSpot
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button><Plus className="w-4 h-4 mr-2" />Add Account</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <CRMTabs
            tabs={[
              { id: 'local', label: 'Local Accounts', count: accounts.length },
              { id: 'hubspot', label: 'HubSpot Companies', count: hsCompanies.length },
            ]}
          >
            {localAccountsTable}
            <HubSpotCompaniesTab companies={hsCompanies} importedIds={importedHsIds} />
          </CRMTabs>
        </CardContent>
      </Card>
    </div>
  )
}
