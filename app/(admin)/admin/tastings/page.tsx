import { customerAccounts, users } from '@/db/schema'
import { db } from '@/db'
import { TastingsPlanner } from '@/components/tastings/TastingsPlanner'
import { requireFeature } from '@/lib/auth/session'
import { getTastingsForView } from '@/actions/tastings'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function isMissingTastingsTable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    (message.includes('tastings') && message.includes('does not exist')) ||
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist'))
  )
}

export default async function AdminTastingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  await requireFeature('tastings', 'admin')
  const params = await searchParams

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
        roles: users.roles,
        active: users.active,
      }).from(users).orderBy(users.name),
      getTastingsForView({}),
    ])

    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tastings</h1>
            <p className="text-muted-foreground mt-1">Schedule in-store tastings, assign tasters, and track upcoming events.</p>
          </div>
          <Link href="/admin/tastings/messages">
            <Button variant="outline">Manage SMS Series</Button>
          </Link>
        </div>
        <TastingsPlanner
          mode="admin"
          tastings={tastings}
          accounts={accounts}
          tasters={tasters.filter(user => user.active && user.roles.includes('taster')).map(user => ({ id: user.id, name: user.name, phone: user.phone }))}
          success={params.success}
          error={params.error}
        />
      </div>
    )
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
}
