import { customerAccounts, users } from '@/db/schema'
import { db } from '@/db'
import { TastingsPlanner } from '@/components/tastings/TastingsPlanner'
import { TasterTeamPanel } from '@/components/tastings/TasterTeamPanel'
import { requireFeature } from '@/lib/auth/session'
import { getTastingsForView } from '@/actions/tastings'
import { getAvailabilityForUsers } from '@/actions/taster-availability'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function isMissingTastingsTable(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    code === '42p01' ||
    code === '42703' ||
    (message.includes('tastings') && message.includes('does not exist')) ||
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist')) ||
    (message.includes('taster_availability') && message.includes('does not exist')) ||
    message.includes('relation') ||
    message.includes('column')
  )
}

export default async function StaffTastingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; account?: string; date?: string }>
}) {
  await requireFeature('tastings', 'admin', 'staff')
  const params = await searchParams
  let data:
    | {
        accounts: Array<{ id: string; companyName: string; address: string | null; city: string | null; state: string | null; zip: string | null }>
        activeTasters: Array<{ id: string; name: string; phone: string | null; avatarUrl?: string | null }>
        tastings: Awaited<ReturnType<typeof getTastingsForView>>
        availability: Awaited<ReturnType<typeof getAvailabilityForUsers>>
      }
    | null = null

  try {
    const [accounts, tasters, tastings] = await Promise.all([
      db.select({
        id: customerAccounts.id,
        companyName: customerAccounts.companyName,
        address: customerAccounts.address,
        city: customerAccounts.city,
        state: customerAccounts.state,
        zip: customerAccounts.zip,
      }).from(customerAccounts).orderBy(customerAccounts.companyName),
      db.select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        roles: users.roles,
        active: users.active,
      }).from(users).orderBy(users.name),
      getTastingsForView({}),
    ])
    const activeTasters = tasters.filter((user) => user.active && (user.roles ?? []).includes('taster'))
    const availability = await getAvailabilityForUsers(activeTasters.map((user) => user.id))
    data = {
      accounts,
      activeTasters: activeTasters.map(user => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      })),
      tastings,
      availability,
    }
  } catch (error) {
    if (!isMissingTastingsTable(error)) throw error

    return (
      <div className="p-4 sm:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tastings</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The tasting tables are not in this database yet. Run `npm run db:migrate` before using tasting scheduling in production.
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tastings</h1>
          <p className="text-muted-foreground mt-1">Coordinate upcoming tastings and keep tasters informed by text.</p>
        </div>
        <Link href="/staff/tastings/reports">
          <Button variant="outline">View Reports</Button>
        </Link>
      </div>
      <TasterTeamPanel
        mode="staff"
        tastings={data.tastings}
        tasters={data.activeTasters}
        availability={data.availability}
      />
      <TastingsPlanner
        mode="staff"
        tastings={data.tastings}
        accounts={data.accounts}
        tasters={data.activeTasters}
        success={params.success}
        error={params.error}
        initialAccountId={params.account}
        initialDate={params.date}
      />
    </div>
  )
}
