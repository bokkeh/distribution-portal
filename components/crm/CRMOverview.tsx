import { Building2, Gauge, UserRoundCheck, UsersRound } from 'lucide-react'

function Metric({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#ff5a00] [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="font-display text-4xl font-bold leading-none text-[#181615]">{value}</p>
      <p className="mt-2 font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function CRMOverview({
  accountCount,
  companyContactCount,
  communityContactCount,
  assignedCount,
  averagePullThrough,
}: {
  accountCount: number
  companyContactCount: number
  communityContactCount: number
  assignedCount: number
  averagePullThrough: number | null
}) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={<Building2 />} label="Company accounts" value={accountCount} description="Wholesale and company CRM records" />
      <Metric icon={<UsersRound />} label="Company contacts" value={companyContactCount} description="People connected to an account" />
      <Metric icon={<UserRoundCheck />} label="Community contacts" value={communityContactCount} description="Brand newsletter members" />
      <Metric icon={<Building2 />} label="Assigned to me" value={assignedCount} description="Accounts owned by your sales profile" />
      <Metric icon={<Gauge />} label="Average pull-through" value={averagePullThrough == null ? '—' : `${averagePullThrough}%`} description="Across accounts with enough data" />
    </div>
  )
}
