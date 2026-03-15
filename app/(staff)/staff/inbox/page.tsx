import { SmsInboxHub } from '@/components/inbox/SmsInboxHub'
import { requireFeature } from '@/lib/auth/session'
import { getInboxContactMatches } from '@/lib/inbox/crm-match'
import { getInboxMessageRows } from '@/lib/inbox/read'

function isMissingSmsMessagesTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('sms_messages') && message.includes('does not exist')
}

export default async function StaffInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  await requireFeature('inbox', 'admin', 'staff')
  const params = await searchParams

  try {
    const rows = await getInboxMessageRows()

    const phones = Array.from(new Set(rows.map(row => row.phoneNumber)))
    const crmMatches = await getInboxContactMatches(phones)
    const threadMap = new Map<string, typeof rows>()

    for (const row of rows) {
      const existing = threadMap.get(row.phoneNumber) ?? []
      existing.push(row)
      threadMap.set(row.phoneNumber, existing)
    }

    const threads = Array.from(threadMap.entries()).map(([phone, messages]) => {
      const [latest] = messages
      const crmMatch = crmMatches.get(phone)
      return {
        phone,
        contactName: crmMatch?.name ?? latest.contactName ?? phone,
        avatarUrl: crmMatch?.avatarUrl ?? null,
        lastBody: latest.body,
        lastDirection: latest.direction,
        lastStatus: latest.status,
        lastAt: latest.createdAt,
        unreadCount: messages.filter(message => message.direction === 'inbound').length,
      }
    })

    const selectedPhone = params.phone && threadMap.has(params.phone) ? params.phone : threads[0]?.phone ?? null
    const selectedMessages = selectedPhone ? (threadMap.get(selectedPhone) ?? []).slice().reverse() : []
    const selectedThread = selectedPhone ? threads.find(thread => thread.phone === selectedPhone) ?? null : null
    const selectedContactName = selectedThread?.contactName ?? ''
    const selectedAvatarUrl = selectedThread?.avatarUrl ?? null

    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Inbox</h1>
          <p className="text-muted-foreground mt-1">Read inbound texts and reply from the platform.</p>
        </div>
        <SmsInboxHub
          basePath="/staff/inbox"
          threads={threads}
          selectedPhone={selectedPhone}
          selectedContactName={selectedContactName}
          selectedAvatarUrl={selectedAvatarUrl}
          messages={selectedMessages.map(message => ({
            id: message.id,
            direction: message.direction,
            body: message.body,
            mediaUrls: message.mediaUrls ?? [],
            status: message.status,
            createdAt: message.createdAt,
          }))}
        />
      </div>
    )
  } catch (error) {
    if (!isMissingSmsMessagesTable(error)) throw error

    return (
      <div className="p-4 sm:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">SMS Inbox</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The SMS inbox table is not in this database yet. Run `npm run db:migrate` before using the inbox in production.
        </div>
      </div>
    )
  }
}
