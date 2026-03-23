import { sendSms } from '@/lib/telnyx/client'
import type { NotificationEvent, NotificationEventPayloads } from '../events'

export async function handleSmsChannel<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventPayloads[E],
): Promise<void> {
  switch (event) {
    case 'order.received': {
      const p = payload as NotificationEventPayloads['order.received']
      if (!p.staffPhones?.length) break
      const shortId = p.orderId.slice(-8).toUpperCase()
      await Promise.all(
        p.staffPhones.map((phone) =>
          sendSms({
            to: phone,
            body: `New order from ${p.companyName} — $${p.total} (${p.purchaseUnit}). Order #${shortId}`,
            userId: p.userId,
            bypassOptOut: true,
          }),
        ),
      )
      break
    }

    case 'order.shipping_status_changed': {
      const p = payload as NotificationEventPayloads['order.shipping_status_changed']
      if (!p.customerPhone) break
      const statusMessages: Record<typeof p.status, string> = {
        not_scheduled: `Your order from AHAWC is awaiting delivery scheduling.`,
        scheduled: `Your AHAWC order has been scheduled for delivery.`,
        out_for_delivery: `Your AHAWC order is out for delivery today.`,
        delivered: `Your AHAWC order has been delivered. Thank you!`,
        issue: `There is an issue affecting your AHAWC delivery. We'll be in touch shortly.`,
      }
      await sendSms({
        to: p.customerPhone,
        body: statusMessages[p.status],
        userId: p.userId,
        contactName: p.companyName,
      })
      break
    }

    case 'delivery.driver_assigned': {
      const p = payload as NotificationEventPayloads['delivery.driver_assigned']
      if (!p.driverPhone) break
      await sendSms({
        to: p.driverPhone,
        body: `Hi ${p.driverName}, you have a delivery route assigned for the week of ${p.weekStartDate} with ${p.stopCount} stop${p.stopCount === 1 ? '' : 's'}. Check the driver portal for details.`,
        userId: p.userId,
        contactName: p.driverName,
        bypassOptOut: true,
      })
      break
    }

    case 'tasting.taster_assigned': {
      const p = payload as NotificationEventPayloads['tasting.taster_assigned']
      if (!p.tasterPhone) break
      const date = p.scheduledAt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      await sendSms({
        to: p.tasterPhone,
        body: `Hi ${p.tasterName}, you've been assigned a tasting at ${p.storeName} on ${date}. Check the taster portal for details.`,
        userId: p.userId,
        contactName: p.tasterName,
      })
      break
    }
  }
}
