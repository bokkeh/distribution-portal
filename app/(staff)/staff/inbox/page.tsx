import { SmsInboxHub } from '@/components/inbox/SmsInboxHub'
import { requireFeature } from '@/lib/auth/session'
import { getInboxContactMatches } from '@/lib/inbox/crm-match'
import { getInboxMessageRows } from '@/lib/inbox/read'
import { getInboxThreadMeta } from '@/lib/inbox/thread-meta'
import { db } from '@/db'
import { customerAccounts, replyTemplates, users } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'

function isMissingSmsMessagesTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('sms_messages') && message.includes('does not exist')
}

function toSafeIsoString(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString()
}

export default async function StaffInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  const session = await requireFeature('inbox', 'admin', 'staff')
  const params = await searchParams

  try {
    const [rowsResult, accountsResult, threadMetaResult, templatesResult, assigneesResult] = await Promise.allSettled([
      getInboxMessageRows(),
      db.select({
        id: customerAccounts.id,
        companyName: customerAccounts.companyName,
        contactName: customerAccounts.contactName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        address: customerAccounts.address,
        businessPhone: customerAccounts.businessPhone,
        pocName: customerAccounts.pocName,
        pocPhone: customerAccounts.pocPhone,
      }).from(customerAccounts),
      getInboxThreadMeta(),
      db.select({
        id: replyTemplates.id,
        title: replyTemplates.title,
        category: replyTemplates.category,
        body: replyTemplates.body,
      }).from(replyTemplates).orderBy(asc(replyTemplates.category), asc(replyTemplates.title)),
      db.select({
        id: users.id,
        name: users.name,
      }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    ])

    const rows = rowsResult.status === 'fulfilled' ? rowsResult.value : []
    const accounts = accountsResult.status === 'fulfilled' ? accountsResult.value : []
    const threadMeta = threadMetaResult.status === 'fulfilled' ? threadMetaResult.value : []
    const templates = templatesResult.status === 'fulfilled' ? templatesResult.value : []
    const assignees = assigneesResult.status === 'fulfilled' ? assigneesResult.value : []
    const threadMetaMap = new Map(threadMeta.map((entry) => [entry.phoneNumber, entry]))

    const phones = Array.from(new Set(rows.map(row => row.phoneNumber)))
    const crmMatches = phones.length ? await getInboxContactMatches(phones).catch(() => new Map()) : new Map()
    const threadMap = new Map<string, typeof rows>()

    for (const row of rows) {
      const existing = threadMap.get(row.phoneNumber) ?? []
      existing.push(row)
      threadMap.set(row.phoneNumber, existing)
    }

    const threads = Array.from(threadMap.entries()).map(([phone, messages]) => {
      const [latest] = messages
      const crmMatch = crmMatches.get(phone)
      const meta = threadMetaMap.get(phone)
      return {
        phone: String(phone),
        contactName: String(crmMatch?.name ?? latest.contactName ?? phone),
        avatarUrl: crmMatch?.avatarUrl ?? null,
        lastBody: String(latest.body ?? ''),
        lastDirection: latest.direction,
        lastStatus: String(latest.status ?? ''),
        lastAt: toSafeIsoString(latest.createdAt),
        unreadCount: messages.filter(message => message.direction === 'inbound').length,
        status: meta?.status ?? 'open',
        priority: meta?.priority ?? 'normal',
        assignedUserId: meta?.assignedUserId ?? null,
        assignedUserName: meta?.assignedUserName ?? null,
        companyName: meta?.companyName ?? null,
      }
    })

    const selectedPhone = params.phone && threadMap.has(params.phone) ? params.phone : threads[0]?.phone ?? null
    const selectedMessages = selectedPhone ? (threadMap.get(selectedPhone) ?? []).slice().reverse() : []
    const selectedThread = selectedPhone ? threads.find(thread => thread.phone === selectedPhone) ?? null : null
    const selectedContactName = selectedThread?.contactName ?? ''
    const selectedAvatarUrl = selectedThread?.avatarUrl ?? null
    const accountOptions = accounts.flatMap((account) => {
      const phone = account.pocPhone || account.businessPhone || account.phone
      if (!phone) return []
      const contactName = account.pocName || account.contactName || account.companyName
      return [{
        id: String(account.id),
        phone: String(phone),
        contactName: String(contactName),
        label: `${account.companyName} (${contactName}) - ${phone}`,
        companyName: String(account.companyName),
        address: account.address ?? undefined,
        email: account.email ?? undefined,
        businessPhone: account.businessPhone ?? undefined,
        pocPhone: account.pocPhone ?? undefined,
      }]
    })

    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Inbox</h1>
          <p className="text-muted-foreground mt-1">Read inbound texts and reply from the platform.</p>
        </div>
        <SmsInboxHub
          basePath="/staff/inbox"
          currentUserId={session.user.id}
          threads={threads}
          selectedPhone={selectedPhone}
          selectedContactName={selectedContactName}
          selectedAvatarUrl={selectedAvatarUrl}
          accounts={accountOptions}
          templates={templates.map((template) => ({
            id: String(template.id),
            title: String(template.title),
            category: String(template.category),
            body: String(template.body),
          }))}
          assignees={assignees.map((assignee) => ({
            id: String(assignee.id),
            name: String(assignee.name),
          }))}
          messages={selectedMessages.map(message => ({
            id: String(message.id),
            direction: message.direction,
            body: String(message.body ?? ''),
            mediaUrls: Array.isArray(message.mediaUrls) ? message.mediaUrls.filter((url): url is string => typeof url === 'string') : [],
            status: String(message.status ?? ''),
            createdAt: toSafeIsoString(message.createdAt),
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
