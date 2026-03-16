import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/session'
import { EMAIL_AUTOMATIONS, TEXT_AUTOMATIONS } from '@/lib/automations/catalog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function AutomationSection({
  title,
  items,
}: {
  title: string
  items: ReadonlyArray<{
    id: string
    channel: string
    audience: string
    name: string
    trigger: string
    destination: string
  }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{item.channel}</span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">{item.audience}</span>
            </div>
            <div className="mt-3">
              <p className="font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-sm text-slate-600">{item.trigger}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{item.destination}</p>
              <Link href={item.destination}>
                <Button variant="outline" size="sm">Open</Button>
              </Link>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default async function AdminAutomationsPage() {
  await requireAdmin()

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
        <p className="mt-1 text-muted-foreground">Review the text and email flows currently connected to the portal.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AutomationSection title="Text Flows" items={TEXT_AUTOMATIONS} />
        <AutomationSection title="Email Flows" items={EMAIL_AUTOMATIONS} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/admin/tastings/messages">
            <Button>Edit Tasting SMS Series</Button>
          </Link>
          <Link href="/admin/system">
            <Button variant="outline">Review Environment Health</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
