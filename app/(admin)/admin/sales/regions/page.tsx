import { requireAdmin } from '@/lib/auth/session'
import { getSalesRegions, getSalesMembers, createSalesRegion } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Globe } from 'lucide-react'
import { NewRegionForm } from './NewRegionForm'

export default async function SalesRegionsPage() {
  await requireAdmin()

  const [regions, members] = await Promise.all([
    getSalesRegions(),
    getSalesMembers(),
  ])

  const memberMap = Object.fromEntries(members.map(m => [m.id, m.user.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Regions</h1>
        <p className="text-slate-500 mt-1">{regions.length} region{regions.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {regions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-400">
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No regions yet.</p>
              </CardContent>
            </Card>
          ) : (
            regions.map(r => (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{r.name}</p>
                      {r.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>
                      )}
                    </div>
                    {r.assignedManagerId && memberMap[r.assignedManagerId] && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        Manager: {memberMap[r.assignedManagerId]}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div>
          <NewRegionForm members={members} />
        </div>
      </div>
    </div>
  )
}
