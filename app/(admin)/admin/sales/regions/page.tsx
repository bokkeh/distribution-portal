export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth/session'
import { getSalesRegions, getSalesMembers, getAllCustomerAccountsForAssignment, getRegionAccountStats } from '@/actions/sales-members'
import { getRegionMapData } from '@/actions/regions-map'
import { getMyRoutes } from '@/actions/sales-routes'
import { NewRegionForm } from './NewRegionForm'
import { RegionList } from './RegionList'
import { RegionsViewToggle } from './RegionsViewToggle'

export default async function SalesRegionsPage() {
  await requireAdmin()

  let regions: Awaited<ReturnType<typeof getSalesRegions>> = []
  let members: Awaited<ReturnType<typeof getSalesMembers>> = []
  let allAccounts: Awaited<ReturnType<typeof getAllCustomerAccountsForAssignment>> = []
  let mapData: Awaited<ReturnType<typeof getRegionMapData>> = { regions: [], accounts: [] }
  let routes: Awaited<ReturnType<typeof getMyRoutes>> = []
  let loadError: string | null = null

  try {
    ;[regions, members, allAccounts, mapData, routes] = await Promise.all([
      getSalesRegions(),
      getSalesMembers(),
      getAllCustomerAccountsForAssignment(),
      getRegionMapData(),
      getMyRoutes(),
    ])
  } catch (e) {
    console.error('[SalesRegionsPage] data load error:', e)
    loadError = e instanceof Error ? e.message : String(e)
  }

  const accountStats = regions.length ? await getRegionAccountStats(regions.map(r => r.id)).catch(e => {
    console.error('[SalesRegionsPage] accountStats error:', e)
    return {} as Record<string, number>
  }) : {}

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-mono whitespace-pre-wrap">
          <strong>Page load error:</strong> {loadError}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Regions</h1>
        <p className="text-slate-500 mt-1">{regions.length} region{regions.length !== 1 ? 's' : ''}</p>
      </div>

      <RegionsViewToggle
        mapData={mapData}
        routes={routes}
        listContent={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RegionList regions={regions} members={members} allAccounts={allAccounts} accountStats={accountStats} />
            </div>
            <div>
              <NewRegionForm members={members} />
            </div>
          </div>
        }
      />
    </div>
  )
}
