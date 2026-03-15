import { Badge } from '@/components/ui/badge'

export function SystemHealthPanel({
  snapshot,
}: {
  snapshot: Awaited<ReturnType<typeof import('@/lib/ops/system-health').getSystemHealthSnapshot>>
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">App Version</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{snapshot.appVersion}</p>
          <p className="mt-2 text-xs text-slate-500">{snapshot.deploymentId}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending Migrations</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {snapshot.migrationHistoryState === 'tracked' ? snapshot.pendingMigrations.length : '—'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {snapshot.migrationHistoryState === 'tracked'
              ? `Expected ${snapshot.expectedMigrations.length}`
              : snapshot.migrationHistoryState === 'untracked'
                ? 'Migration history not tracked in this database'
                : 'Migration table not found'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Missing Tables</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{snapshot.missingTables.length}</p>
          <p className="mt-2 text-xs text-slate-500">Schema drift watch</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Missing Columns</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{snapshot.missingColumns.length}</p>
          <p className="mt-2 text-xs text-slate-500">Production compatibility</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">External Services</h2>
          <div className="mt-4 space-y-3">
            {snapshot.envChecks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{check.label}</p>
                  <p className="text-xs text-slate-500">{check.detail}</p>
                </div>
                <Badge variant={check.ok ? 'success' : 'destructive'}>{check.ok ? 'Ready' : 'Needs config'}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">Migration Status</h2>
          <div className="mt-4 space-y-2">
            {snapshot.migrationHistoryState !== 'tracked' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                {snapshot.migrationHistoryState === 'untracked'
                  ? 'This database has application tables, but Drizzle migration history is not recorded. Migration status is unavailable, so entries are shown as untracked instead of pending.'
                  : 'The __drizzle_migrations table was not found. Migration status is unavailable for this database.'}
              </div>
            ) : null}
            {snapshot.expectedMigrations.map((migration) => {
              const applied = snapshot.appliedMigrations.includes(migration)
              return (
                <div key={migration} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="font-mono text-xs text-slate-700">{migration}</span>
                  <Badge
                    variant={
                      snapshot.migrationHistoryState === 'tracked'
                        ? applied ? 'success' : 'warning'
                        : 'secondary'
                    }
                  >
                    {snapshot.migrationHistoryState === 'tracked'
                      ? applied ? 'Applied' : 'Pending'
                      : 'Untracked'}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">Schema Drift</h2>
          <div className="mt-4 space-y-3">
            {snapshot.missingTables.length === 0 && snapshot.missingColumns.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                No missing required tables or columns detected.
              </div>
            ) : null}
            {snapshot.missingTables.length > 0 || snapshot.missingColumns.length > 0 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800">
                Repair command: <span className="font-mono">npm run db:repair:platform-ops</span>
              </div>
            ) : null}
            {snapshot.missingTables.map((tableName) => (
              <div key={tableName} className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                Missing table: <span className="font-mono">{tableName}</span>
              </div>
            ))}
            {snapshot.missingColumns.map((column) => (
              <div key={`${column.tableName}-${column.columnName}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                Missing column: <span className="font-mono">{column.tableName}.{column.columnName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
