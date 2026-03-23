import {
  createNotificationsForRoles,
  createUserNotification,
} from '@/lib/notifications/in-app'
import type { NotificationEvent, NotificationEventPayloads } from '../events'

export async function handleInAppChannel<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventPayloads[E],
): Promise<void> {
  switch (event) {
    case 'order.received': {
      const p = payload as NotificationEventPayloads['order.received']
      const shortId = p.orderId.slice(-8).toUpperCase()
      await createNotificationsForRoles({
        roles: ['admin', 'staff'],
        kind: 'order.received',
        title: `New order from ${p.companyName}`,
        body: `$${p.total} — Order #${shortId}`,
        href: `/admin/orders/${p.orderId}`,
      })
      break
    }

    case 'order.status_changed': {
      const p = payload as NotificationEventPayloads['order.status_changed']
      const statusLabels: Record<typeof p.status, string> = {
        pending: 'Order is pending review',
        confirmed: 'Order confirmed',
        fulfilled: 'Order complete',
        cancelled: 'Order cancelled',
      }
      if (!p.userId) break
      await createUserNotification({
        userId: p.userId,
        kind: 'order.status_changed',
        title: statusLabels[p.status],
        body: `${p.companyName} — Order #${p.orderId.slice(-8).toUpperCase()}`,
        href: `/customer/orders/${p.orderId}`,
      })
      break
    }

    case 'order.shipping_status_changed': {
      const p = payload as NotificationEventPayloads['order.shipping_status_changed']
      if (!p.userId) break
      const shippingLabels: Record<typeof p.status, string> = {
        not_scheduled: 'Delivery not yet scheduled',
        scheduled: 'Delivery scheduled',
        out_for_delivery: 'Order out for delivery',
        delivered: 'Order delivered',
        issue: 'Delivery issue',
      }
      await createUserNotification({
        userId: p.userId,
        kind: 'order.shipping_status_changed',
        title: shippingLabels[p.status],
        body: `${p.companyName} — Order #${p.orderId.slice(-8).toUpperCase()}`,
        href: `/customer/orders/${p.orderId}`,
      })
      break
    }

    case 'invoice.paid': {
      const p = payload as NotificationEventPayloads['invoice.paid']
      await createNotificationsForRoles({
        roles: ['admin', 'staff'],
        kind: 'invoice.paid',
        title: `Invoice paid — ${p.companyName}`,
        body: `${p.invoiceNumber} · $${p.total}`,
      })
      break
    }

    case 'delivery.driver_assigned': {
      const p = payload as NotificationEventPayloads['delivery.driver_assigned']
      if (!p.userId) break
      await createUserNotification({
        userId: p.userId,
        kind: 'delivery.driver_assigned',
        title: 'Delivery route assigned',
        body: `Week of ${p.weekStartDate} — ${p.stopCount} stop${p.stopCount === 1 ? '' : 's'}`,
        href: '/driver/deliveries',
      })
      break
    }

    case 'wholesale_request.received': {
      const p = payload as NotificationEventPayloads['wholesale_request.received']
      await createNotificationsForRoles({
        roles: ['admin'],
        kind: 'wholesale_request.received',
        title: `New wholesale request`,
        body: p.businessName,
        href: '/admin/wholesale-requests',
      })
      break
    }

    case 'delivery.completed': {
      const p = payload as NotificationEventPayloads['delivery.completed']
      await Promise.all([
        createNotificationsForRoles({
          roles: ['admin'],
          kind: 'delivery_completed',
          title: 'Delivery completed',
          body: `${p.companyName} was marked delivered.`,
          href: `/admin/deliveries/${p.deliveryId}`,
        }),
        createNotificationsForRoles({
          roles: ['staff'],
          kind: 'delivery_completed',
          title: 'Delivery completed',
          body: `${p.companyName} was marked delivered.`,
          href: null,
        }),
      ])
      break
    }

    case 'delivery.run_completed': {
      const p = payload as NotificationEventPayloads['delivery.run_completed']
      await createNotificationsForRoles({
        roles: ['admin', 'staff'],
        kind: 'delivery_completed',
        title: 'Delivery run completed',
        body: 'All stops on a delivery run have been completed.',
        href: `/admin/deliveries/${p.deliveryId}`,
      })
      break
    }

    case 'tasting.taster_assigned': {
      const p = payload as NotificationEventPayloads['tasting.taster_assigned']
      if (!p.userId) break
      const date = p.scheduledAt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      await Promise.all([
        createUserNotification({
          userId: p.userId,
          kind: 'tasting_assigned',
          title: `Tasting assigned — ${p.storeName}`,
          body: date,
          href: `/taster/tastings/${p.tastingId}`,
        }),
        createUserNotification({
          userId: p.userId,
          kind: 'tasting_report_reminder',
          title: 'Complete your tasting report',
          body: `Submit your tasting report for ${p.storeName}.`,
          href: `/taster/tastings/${p.tastingId}`,
          availableAt: new Date(p.scheduledAt.getTime() + 24 * 60 * 60 * 1000),
        }),
      ])
      break
    }

    case 'tasting.taster_declined': {
      const p = payload as NotificationEventPayloads['tasting.taster_declined']
      await createNotificationsForRoles({
        roles: ['admin', 'staff'],
        kind: 'tasting_declined',
        title: 'Tasting declined',
        body: `${p.declinedByName} declined ${p.eventName}.`,
        href: '/admin/tastings',
      })
      break
    }
  }
}
