import { desc, eq, inArray, and } from 'drizzle-orm'
import { db } from '@/db'
import { activityEvents } from '@/db/schema'
import { sendInvoiceEmail } from '@/actions/invoices'
import { InvoiceSendButton } from './InvoiceSendButton'

export async function InvoiceSendForm({ invoiceId, status, defaultEmail, portal }: {
  invoiceId: string; status: string; defaultEmail: string; portal: 'admin' | 'staff' | 'field'
}) {
  const [lastSend] = await db.select({ metadata: activityEvents.metadata, createdAt: activityEvents.createdAt })
    .from(activityEvents).where(and(eq(activityEvents.entityId, invoiceId), eq(activityEvents.entityType, 'invoice'),
      inArray(activityEvents.kind, ['invoice_sent', 'invoice_resent'])))
    .orderBy(desc(activityEvents.createdAt)).limit(1)
  const metadata = lastSend?.metadata as { recipientEmail?: string } | null
  return <form action={sendInvoiceEmail.bind(null, invoiceId)} className="space-y-3 rounded-xl border p-3">
    <input type="hidden" name="portal" value={portal} />
    <p className="text-sm text-muted-foreground">{status === 'draft' ? 'Saved draft — nothing is emailed until you click Send.' : 'Send this same invoice to the original or a different email.'}</p>
    <label className="block text-sm font-medium">Recipient email
      <input name="recipientEmail" type="email" required maxLength={254} defaultValue={metadata?.recipientEmail ?? defaultEmail}
        className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3 text-base" autoComplete="email" />
    </label>
    <InvoiceSendButton draft={status === 'draft'} />
    {metadata?.recipientEmail ? <p className="break-words text-xs text-muted-foreground">Last sent to {metadata.recipientEmail}. Changing this address applies only to this invoice.</p> : null}
  </form>
}
