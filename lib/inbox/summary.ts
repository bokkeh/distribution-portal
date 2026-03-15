import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { smsMessages } from '@/db/schema'

function isMissingSmsMessagesTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('sms_messages') && message.includes('does not exist')
}

export async function getSmsInboxSummary() {
  try {
    const rows = await db
      .select({
        phoneNumber: smsMessages.phoneNumber,
        direction: smsMessages.direction,
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .orderBy(desc(smsMessages.createdAt))

    const latestByPhone = new Map<string, (typeof rows)[number]>()

    for (const row of rows) {
      if (!latestByPhone.has(row.phoneNumber)) {
        latestByPhone.set(row.phoneNumber, row)
      }
    }

    const openThreads = Array.from(latestByPhone.values()).filter(
      (thread) => thread.direction === 'inbound'
    ).length

    return {
      totalTexts: rows.length,
      openThreads,
    }
  } catch (error) {
    if (isMissingSmsMessagesTable(error)) {
      return {
        totalTexts: 0,
        openThreads: 0,
      }
    }

    throw error
  }
}
