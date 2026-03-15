import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/db'
import { replyTemplates } from '@/db/schema'
import { deleteReplyTemplate } from '@/actions/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function AdminInboxTemplatesPage() {
  await requireAdmin()

  const templates = await db.select({
    id: replyTemplates.id,
    title: replyTemplates.title,
    category: replyTemplates.category,
    body: replyTemplates.body,
    createdAt: replyTemplates.createdAt,
  }).from(replyTemplates).orderBy(asc(replyTemplates.category), asc(replyTemplates.title))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inbox">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbox Reply Templates</h1>
          <p className="mt-1 text-muted-foreground">Manage canned replies used across the CRM conversation hub.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reply templates saved yet. Save one from the inbox reply area.</p>
          ) : templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{template.title}</p>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{template.body}</p>
                </div>
                <form action={deleteReplyTemplate.bind(null, template.id)}>
                  <Button variant="outline" size="sm" type="submit">Delete</Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
