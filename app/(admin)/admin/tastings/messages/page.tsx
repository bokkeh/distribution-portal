import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { upsertDefaultTastingSmsTemplates, getTastingSmsTemplates } from '@/lib/tastings/sms-series'
import { Button } from '@/components/ui/button'
import { TastingMessageSeriesEditor } from '@/components/tastings/TastingMessageSeriesEditor'

export default async function AdminTastingMessagesPage() {
  await requireAdmin()
  await upsertDefaultTastingSmsTemplates()
  const templates = await getTastingSmsTemplates()

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/tastings"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasting SMS Series</h1>
          <p className="mt-1 text-muted-foreground">Review and edit the connected message sequence sent to tasters throughout a tasting lifecycle.</p>
        </div>
      </div>

      <TastingMessageSeriesEditor templates={templates} />
    </div>
  )
}
