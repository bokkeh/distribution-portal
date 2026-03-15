import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { smsMessages } from '@/db/schema'

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
}

function isMissingSmsMessagesTable(error: unknown) {
  const message = getErrorText(error)
  return message.includes('sms_messages') && message.includes('does not exist')
}

function isMissingMediaUrlsColumn(error: unknown) {
  const message = getErrorText(error)
  return message.includes('sms_messages') && message.includes('media_urls')
}

export async function getInboxMessageRows() {
  try {
    return await db
      .select({
        id: smsMessages.id,
        userId: smsMessages.userId,
        direction: smsMessages.direction,
        phoneNumber: smsMessages.phoneNumber,
        contactName: smsMessages.contactName,
        body: smsMessages.body,
        mediaUrls: smsMessages.mediaUrls,
        status: smsMessages.status,
        providerMessageId: smsMessages.providerMessageId,
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .orderBy(desc(smsMessages.createdAt))
  } catch (error) {
    if (isMissingSmsMessagesTable(error)) throw error
    if (!isMissingMediaUrlsColumn(error)) throw error

    const rows = await db
      .select({
        id: smsMessages.id,
        userId: smsMessages.userId,
        direction: smsMessages.direction,
        phoneNumber: smsMessages.phoneNumber,
        contactName: smsMessages.contactName,
        body: smsMessages.body,
        status: smsMessages.status,
        providerMessageId: smsMessages.providerMessageId,
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .orderBy(desc(smsMessages.createdAt))

    return rows.map((row) => ({ ...row, mediaUrls: [] as string[] }))
  }
}
