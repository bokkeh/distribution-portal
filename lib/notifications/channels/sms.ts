import { sendSms } from '@/lib/telnyx/client'
import { formatTastingSmsPayload, sendTastingSmsFromTemplate } from '@/lib/tastings/sms-series'
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

    case 'delivery.completed': {
      const p = payload as NotificationEventPayloads['delivery.completed']
      const staffPhones = [
        process.env.ADMIN_NOTIFICATION_PHONE,
        '+12489339350',
        process.env.ORDER_NOTIFY_KRISTEN_PHONE,
      ].filter(Boolean) as string[]

      await Promise.allSettled([
        ...staffPhones.map((phone) =>
          sendSms({
            to: phone,
            body: `AHAWC: Stop delivered — ${p.companyName}. View: ${process.env.NEXTAUTH_URL}/admin/deliveries/${p.deliveryId}`,
            bypassOptOut: true,
          }),
        ),
        p.customerPhone
          ? sendSms({
              to: p.customerPhone,
              body: `AHAWC: Your order for ${p.companyName} has been delivered. Thank you!`,
            })
          : Promise.resolve(),
      ])
      break
    }

    case 'delivery.run_completed': {
      const p = payload as NotificationEventPayloads['delivery.run_completed']
      const staffPhones = [
        process.env.ADMIN_NOTIFICATION_PHONE,
        '+12489339350',
        process.env.ORDER_NOTIFY_KRISTEN_PHONE,
      ].filter(Boolean) as string[]
      await Promise.allSettled(
        staffPhones.map((phone) =>
          sendSms({
            to: phone,
            body: `AHAWC: All stops on a delivery run are now complete. View: ${p.deliveryUrl}`,
            bypassOptOut: true,
          }),
        ),
      )
      break
    }

    case 'tasting.taster_assigned': {
      const p = payload as NotificationEventPayloads['tasting.taster_assigned']
      if (!p.tasterPhone) break
      await sendTastingSmsFromTemplate({
        templateKey: 'assignment',
        payload: formatTastingSmsPayload({
          tastingId: p.tastingId,
          userId: p.userId ?? p.tastingId,
          phoneNumber: p.tasterPhone,
          storeName: p.storeName,
          storeAddress: p.storeAddress,
          scheduledAt: p.scheduledAt,
          endAt: p.endAt ?? null,
        }),
      })
      break
    }

    case 'tasting.status_changed': {
      const p = payload as NotificationEventPayloads['tasting.status_changed']
      if (p.status !== 'confirmed' || !p.tasterPhone) break
      await sendTastingSmsFromTemplate({
        templateKey: 'confirmation_received',
        payload: formatTastingSmsPayload({
          tastingId: p.tastingId,
          userId: p.userId ?? p.tastingId,
          phoneNumber: p.tasterPhone,
          storeName: p.storeName,
          storeAddress: p.storeAddress ?? '',
          scheduledAt: p.scheduledAt,
          endAt: p.endAt ?? null,
        }),
      })
      break
    }

    case 'tasting.taster_declined': {
      const p = payload as NotificationEventPayloads['tasting.taster_declined']
      const teamMessage = `AHAWC Tasting Declined: ${p.declinedByName} declined ${p.eventName} on ${p.scheduledAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}. Review it in the portal.`
      await Promise.allSettled(
        p.teamPhones.map(({ phone, userId }) =>
          sendSms({ to: phone, body: teamMessage, userId, contactName: 'AHAWC team' }),
        ),
      )
      break
    }
  }
}
