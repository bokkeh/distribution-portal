import type { NotificationChannel, NotificationResult } from './types'
import type { NotificationEvent, NotificationEventPayloads } from './events'
import { EVENT_CHANNELS } from './events'
import { handleEmailChannel } from './channels/email'
import { handleSmsChannel } from './channels/sms'
import { handleChatChannel } from './channels/chat'
import { handleInAppChannel } from './channels/in-app'

// SMS opt-out is not a failure — silence it
function isSmsOptOut(error: unknown) {
  return error instanceof Error && error.message.includes('opted out')
}

type AnyHandler = (event: NotificationEvent, payload: NotificationEventPayloads[NotificationEvent]) => Promise<void>

const CHANNEL_HANDLERS: Record<NotificationChannel, AnyHandler> = {
  email: handleEmailChannel as AnyHandler,
  sms: handleSmsChannel as AnyHandler,
  chat: handleChatChannel as AnyHandler,
  'in-app': handleInAppChannel as AnyHandler,
}

/**
 * Dispatch a notification event to all registered channels.
 *
 * - All channels run in parallel.
 * - Channel failures are isolated — one failing channel never blocks others.
 * - SMS opt-outs are silently skipped (not reported as errors).
 * - Results are returned for optional inspection; nothing is thrown.
 *
 * @example
 * await notify('order.received', {
 *   companyName: 'Acme Spirits',
 *   orderId: order.id,
 *   total: '1250.00',
 *   purchaseUnit: 'case',
 *   placedBy: 'Jane Smith',
 *   customerEmails: [account.email],
 *   staffPhones: ['+12125550100'],
 *   userId: session.user.id,
 * })
 */
export async function notify<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventPayloads[E],
): Promise<NotificationResult[]> {
  const channels = EVENT_CHANNELS[event] ?? []

  const settled = await Promise.allSettled(
    channels.map(async (channel): Promise<NotificationResult> => {
      try {
        await CHANNEL_HANDLERS[channel](event, payload as NotificationEventPayloads[NotificationEvent])
        return { channel, success: true }
      } catch (error) {
        if (channel === 'sms' && isSmsOptOut(error)) {
          return { channel, success: true }
        }
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[notify] ${event} → ${channel} failed:`, error)
        return { channel, success: false, error: message }
      }
    }),
  )

  return settled.map((r) =>
    r.status === 'fulfilled' ? r.value : { channel: 'email' as NotificationChannel, success: false, error: 'Unexpected rejection' },
  )
}
