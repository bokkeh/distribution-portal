import { requireAdmin } from '@/lib/auth/session'
import { getSystemHealthSnapshot } from '@/lib/ops/system-health'
import { SystemHealthPanel } from '@/components/ops/SystemHealthPanel'

export default async function AdminSystemHealthPage() {
  await requireAdmin()
  const snapshot = await getSystemHealthSnapshot()

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
        <p className="mt-1 text-muted-foreground">Track deployment state, schema drift, migration gaps, and third-party configuration.</p>
      </div>
      <SystemHealthPanel snapshot={snapshot} />
    </div>
  )
}
