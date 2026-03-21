import { requireAdmin } from '@/lib/auth/session'
import { getSalesRegions, getSalesMembers } from '@/actions/sales-members'
import { Globe } from 'lucide-react'
import { NewRegionForm } from './NewRegionForm'
import { RegionList } from './RegionList'

export default async function SalesRegionsPage() {
  await requireAdmin()

  const [regions, members] = await Promise.all([
    getSalesRegions(),
    getSalesMembers(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Regions</h1>
        <p className="text-slate-500 mt-1">{regions.length} region{regions.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RegionList regions={regions} members={members} />
        <NewRegionForm members={members} />
      </div>
    </div>
  )
}
