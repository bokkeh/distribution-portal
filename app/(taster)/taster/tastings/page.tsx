import { TasterTastingsHub } from '@/components/tastings/TasterTastingsHub'
import { getTastingsForView } from '@/actions/tastings'
import { requireFeature } from '@/lib/auth/session'

function isMissingTastingsTable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    (message.includes('tastings') && message.includes('does not exist')) ||
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist'))
  )
}

export default async function TasterTastingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const params = await searchParams

  try {
    const tastings = await getTastingsForView({
      assignedUserId: session.user.roles.includes('admin') ? undefined : session.user.id,
    })

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Tastings</h1>
          <p className="text-muted-foreground mt-1">See upcoming and past tastings, then complete reports and invoices from one place.</p>
        </div>
        <TasterTastingsHub tastings={tastings} success={params.success} error={params.error} />
      </div>
    )
  } catch (error) {
    if (!isMissingTastingsTable(error)) throw error

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">My Tastings</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The tasting tables are not in this database yet. Run `npm run db:migrate` before using tasting scheduling in production.
        </div>
      </div>
    )
  }
}
