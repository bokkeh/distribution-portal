import { requireAdminOrStaff } from '@/lib/auth/session'
import { getLeaderboard } from '@/actions/progression'
import { LeaderboardView } from '@/components/progression/LeaderboardView'

export default async function LeaderboardPage() {
  await requireAdminOrStaff()
  const { entries, mostImproved } = await getLeaderboard()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Performance Leaderboard</h1>
        <p className="mt-1 text-slate-500">Ranked within level brackets so a Level 1 taster is never compared directly to national sales leaders.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <LeaderboardView entries={entries} mostImproved={mostImproved} />
      </div>
    </div>
  )
}
