import { desc, eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, smsMessages, smsThreads, users } from '@/db/schema'

function isMissingInboxThreadTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('sms_threads') && message.includes('does not exist')
}

export type InboxThreadMeta = {
  phoneNumber: string
  status: 'open' | 'resolved'
  priority: 'normal' | 'starred'
  assignedUserId: string | null
  assignedUserName: string | null
  customerId: string | null
  companyName: string | null
}

export async function upsertSmsThread(input: {
  phoneNumber: string
  customerId?: string | null
  lastMessageAt?: Date
}) {
  try {
    const [existing] = await db
      .select({ id: smsThreads.id })
      .from(smsThreads)
      .where(eq(smsThreads.phoneNumber, input.phoneNumber))
      .limit(1)

    if (existing) {
      await db.update(smsThreads)
        .set({
          customerId: input.customerId ?? undefined,
          lastMessageAt: input.lastMessageAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(smsThreads.id, existing.id))
      return
    }

    await db.insert(smsThreads).values({
      phoneNumber: input.phoneNumber,
      customerId: input.customerId ?? null,
      lastMessageAt: input.lastMessageAt ?? new Date(),
    })
  } catch (error) {
    if (!isMissingInboxThreadTable(error)) {
      console.error('Failed to upsert SMS thread:', error)
    }
  }
}

export async function getInboxThreadMeta() {
  try {
    return await db
      .select({
        phoneNumber: smsThreads.phoneNumber,
        status: smsThreads.status,
        priority: smsThreads.priority,
        assignedUserId: smsThreads.assignedUserId,
        assignedUserName: users.name,
        customerId: smsThreads.customerId,
        companyName: customerAccounts.companyName,
      })
      .from(smsThreads)
      .leftJoin(users, eq(smsThreads.assignedUserId, users.id))
      .leftJoin(customerAccounts, eq(smsThreads.customerId, customerAccounts.id))
      .orderBy(desc(smsThreads.lastMessageAt))
  } catch (error) {
    if (!isMissingInboxThreadTable(error)) {
      console.error('Failed to read SMS thread metadata:', error)
    }
    return [] as InboxThreadMeta[]
  }
}

export async function inferThreadCustomerId(phoneNumber: string) {
  const [account] = await db
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(
      or(
        eq(customerAccounts.phone, phoneNumber),
        eq(customerAccounts.businessPhone, phoneNumber),
        eq(customerAccounts.pocPhone, phoneNumber),
      )
    )
    .limit(1)

  return account?.id ?? null
}

export async function getRecentInboxActivityCounts() {
  const rows = await db
    .select({
      id: smsMessages.id,
      direction: smsMessages.direction,
      phoneNumber: smsMessages.phoneNumber,
      createdAt: smsMessages.createdAt,
    })
    .from(smsMessages)
    .orderBy(desc(smsMessages.createdAt))
    .limit(200)

  const openPhones = new Set<string>()
  const latestByPhone = new Map<string, 'inbound' | 'outbound'>()

  for (const row of rows) {
    if (!latestByPhone.has(row.phoneNumber)) {
      latestByPhone.set(row.phoneNumber, row.direction)
    }
  }

  for (const [phone, direction] of latestByPhone.entries()) {
    if (direction === 'inbound') openPhones.add(phone)
  }

  return {
    totalMessages: rows.length,
    openThreads: openPhones.size,
  }
}
