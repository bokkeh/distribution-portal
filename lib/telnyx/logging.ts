import { db } from '@/db'
import { smsMessages } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { inferThreadCustomerId, upsertSmsThread } from '@/lib/inbox/thread-meta'

function isMissingSmsMessagesTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('sms_messages') && message.includes('does not exist')
}

export async function logSmsMessage({
  userId,
  direction,
  phoneNumber,
  contactName,
  body,
  mediaUrls,
  status,
  providerMessageId,
  groupParticipants,
}: {
  userId?: string | null
  direction: 'inbound' | 'outbound'
  phoneNumber: string
  contactName?: string | null
  body: string
  mediaUrls?: string[] | null
  status: 'received' | 'sent' | 'failed'
  providerMessageId?: string | null
  groupParticipants?: string[]
}) {
  try {
    const customerId = await inferThreadCustomerId(phoneNumber)
    await upsertSmsThread({
      phoneNumber,
      customerId,
      lastMessageAt: new Date(),
      groupParticipants,
    })

    await db.insert(smsMessages).values({
      userId: userId ?? null,
      direction,
      phoneNumber,
      contactName: contactName ?? null,
      body,
      mediaUrls: mediaUrls?.length ? mediaUrls : null,
      status,
      providerMessageId: providerMessageId ?? null,
    })

    await logActivityEvent({
      entityType: 'inbox_thread',
      entityId: phoneNumber,
      actorUserId: userId ?? null,
      kind: direction === 'inbound' ? 'sms_received' : 'sms_sent',
      title: direction === 'inbound' ? 'Text received' : 'Text sent',
      body,
      metadata: {
        mediaCount: mediaUrls?.length ?? 0,
        status,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (message.includes('sms_messages') && message.includes('media_urls')) {
      try {
        await db.insert(smsMessages).values({
          userId: userId ?? null,
          direction,
          phoneNumber,
          contactName: contactName ?? null,
          body,
          status,
          providerMessageId: providerMessageId ?? null,
        })
        return
      } catch (fallbackError) {
        if (!isMissingSmsMessagesTable(fallbackError)) {
          console.error('SMS message log fallback failed:', fallbackError)
        }
        return
      }
    }

    if (!isMissingSmsMessagesTable(error)) {
      console.error('SMS message log failed:', error)
    }
  }
}
