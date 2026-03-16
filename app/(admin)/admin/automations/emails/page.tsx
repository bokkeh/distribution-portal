import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { upsertDefaultEmailAutomationTemplates, getEmailAutomationTemplates } from '@/lib/resend/email-templates'
import { Button } from '@/components/ui/button'
import { EmailAutomationSeriesEditor } from '@/components/automations/EmailAutomationSeriesEditor'

export default async function AdminEmailAutomationsPage() {
  await requireAdmin()
  await upsertDefaultEmailAutomationTemplates()
  const templates = await getEmailAutomationTemplates()

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/automations">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Flows</h1>
          <p className="mt-1 text-muted-foreground">Review and edit the automated email series connected to customer, taster, driver, and internal workflows.</p>
        </div>
      </div>

      <EmailAutomationSeriesEditor templates={templates} />
    </div>
  )
}
