import { Truck } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { DriverWorkspaceHero } from '@/components/deliveries/DriverWorkspaceHero'
import { getDriverWorkspaceData } from '@/lib/driver/deliveries'

export default async function DriverDashboardPage() {
  const session = await requireRole('driver', 'admin')
  const workspace = await getDriverWorkspaceData(session.user.id)

  if (!workspace) {
    return (
      <div className="py-16 text-center">
        <Truck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="text-muted-foreground">No driver profile found. Contact your administrator.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DriverWorkspaceHero
        workspace={workspace}
        title="Driver Dashboard"
        description="See active route readiness, dispatch priorities, and quick actions before you jump into the full stop workflow."
      />
    </div>
  )
}
