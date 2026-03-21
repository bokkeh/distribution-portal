import { requireAdmin } from '@/lib/auth/session'
import { getSalesRegions, getSalesMembers, getAllCustomerAccountsForAssignment, getRegionAccountStats } from '@/actions/sales-members'
import { NewRegionForm } from './NewRegionForm'
import { RegionList } from './RegionList'

export default async function SalesRegionsPage() {
  await requireAdmin()

  const [regions, members, allAccounts] = await Promise.all([
    getSalesRegions(),
    getSalesMembers(),
    getAllCustomerAccountsForAssignment(),
  ])

  const accountStats = await getRegionAccountStats(regions.map(r => r.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Regions</h1>
        <p className="text-slate-500 mt-1">{regions.length} region{regions.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RegionList regions={regions} members={members} allAccounts={allAccounts} accountStats={accountStats} />
        </div>
        <div>
          <NewRegionForm members={members} />
        </div>
      </div>
    </div>
  )
}
