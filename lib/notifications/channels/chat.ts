import { postGoogleChatCard } from '@/lib/google-chat/webhook'
import type { NotificationEvent, NotificationEventPayloads } from '../events'

export async function handleChatChannel<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventPayloads[E],
): Promise<void> {
  switch (event) {
    case 'order.received': {
      const p = payload as NotificationEventPayloads['order.received']
      const shortId = p.orderId.slice(-8).toUpperCase()
      await postGoogleChatCard(
        'New Order',
        `<b>${p.companyName}</b> placed a ${p.purchaseUnit} order for <b>$${p.total}</b> via ${p.placedBy}. Order #${shortId}`,
      )
      break
    }

    case 'wholesale_request.received': {
      const p = payload as NotificationEventPayloads['wholesale_request.received']
      await postGoogleChatCard(
        'Wholesale Request',
        `New wholesale account request from <b>${p.businessName}</b> (${p.businessEmail})${p.businessType ? ` — ${p.businessType}` : ''}.`,
      )
      break
    }
  }
}
