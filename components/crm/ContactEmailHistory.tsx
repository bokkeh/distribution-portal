import { db } from '@/db'
import { contactEmails } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function ContactEmailHistory({ contactId, accountId }: { contactId?: string; accountId?: string }) {
  await requireAdminOrStaff()
  if (!contactId && !accountId) return null
  const rows = await db.select().from(contactEmails).where(contactId ? eq(contactEmails.contactId, contactId) : eq(contactEmails.accountId, accountId!)).orderBy(desc(contactEmails.createdAt)).limit(100)
  return <Card><CardHeader><CardTitle>Email history</CardTitle><p className="text-xs text-slate-500">Provider acceptance is separate from confirmed delivery. Older unrecorded messages are not included. Saved drafts are listed separately from queued and accepted sends.</p></CardHeader>
    <CardContent className="space-y-3">{!rows.length && <p className="text-sm text-slate-500">No recorded emails.</p>}
      {rows.map(row => <details key={row.id} className="rounded border p-3 text-sm">
        <summary>{row.subject} · {row.status} · {row.createdAt.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</summary>
        <p>From: {row.sender} · To: {row.recipient}</p><p>Reply-to: {row.replyTo ?? row.sender}</p>
        <p className="whitespace-pre-wrap py-2">{row.body}</p>{row.deliveryEvents.map(event => <p key={event.id} className="text-xs">{event.type} · {event.at}</p>)}{row.error && <p className="text-red-700">{row.error}</p>}
      </details>)}
    </CardContent></Card>
}
