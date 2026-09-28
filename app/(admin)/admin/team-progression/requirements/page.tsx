import { requireAdmin } from '@/lib/auth/session'
import { getRequirementsAdmin, getStarterKitAdmin } from '@/actions/progression'
import { RequirementsEditor } from '@/components/progression/RequirementsEditor'
import { StarterKitEditor } from '@/components/progression/StarterKitEditor'
import { PageTabs } from '@/components/ui/PageTabs'

export default async function RankRequirementsPage() {
  await requireAdmin()
  const [requirements, starterKitItems] = await Promise.all([getRequirementsAdmin(), getStarterKitAdmin()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rank Requirements</h1>
        <p className="mt-1 text-slate-500">Define what it takes to reach each rank. Nothing here is hard-coded — edit thresholds any time.</p>
      </div>

      <PageTabs tabs={[{ id: 'requirements', label: 'Requirements by rank' }, { id: 'starter-kit', label: 'Starter kit (Level 1)' }]}>
        {[
          <div key="requirements" className="rounded-xl border border-slate-200 bg-white p-5">
            <RequirementsEditor requirements={requirements} />
          </div>,
          <div key="starter-kit" className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm text-slate-500">Add, remove, reorder, and edit the onboarding checklist every new team member sees at Level 1.</p>
            <StarterKitEditor items={starterKitItems} />
          </div>,
        ]}
      </PageTabs>
    </div>
  )
}
