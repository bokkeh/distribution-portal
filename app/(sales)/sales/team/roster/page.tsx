import { requireRole } from '@/lib/auth/session'
import { getRoster } from '@/actions/progression'
import { RosterView } from '@/components/progression/RosterView'

export default async function SalesTeamRosterPage() {
  await requireRole('sales_manager', 'admin')
  const { entries } = await getRoster()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Roster</h1>
        <p className="mt-1 text-slate-500">{entries.length} people across the tasting &amp; sales program.</p>
      </div>
      <RosterView entries={entries} baseHref="/sales/team/roster" />
    </div>
  )
}
