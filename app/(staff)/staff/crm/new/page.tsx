import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { asc } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateAccountForm } from '@/components/crm/CreateAccountForm'
import { db } from '@/db'
import { crmPipelineStages } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { coercePipelineStages, normalizePipelineStageKey } from '@/lib/deal-stages'

export default async function StaffNewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  await requireFeature('crm', 'staff')
  const { stage } = await searchParams
  const pipelineStages = coercePipelineStages(
    await db
      .select({
        id: crmPipelineStages.id,
        stageKey: crmPipelineStages.stageKey,
        label: crmPipelineStages.label,
        colorToken: crmPipelineStages.colorToken,
        position: crmPipelineStages.position,
      })
      .from(crmPipelineStages)
      .orderBy(asc(crmPipelineStages.position), asc(crmPipelineStages.label))
  )
  const defaultDealStage = pipelineStages.find((item) => item.stageKey === normalizePipelineStageKey(stage))?.stageKey
    ?? pipelineStages[0]?.stageKey
    ?? 'new_lead'

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/staff/crm">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Account</h1>
          <p className="mt-1 text-muted-foreground">Create a new CRM account.</p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>New Customer Account</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateAccountForm pipelineStages={pipelineStages} defaultDealStage={defaultDealStage} basePath="/staff/crm" />
        </CardContent>
      </Card>
    </div>
  )
}
