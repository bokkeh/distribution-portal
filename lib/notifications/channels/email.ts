import {
  sendDeliveryCompletedEmail,
  sendDriverDeliveryAssignmentEmail,
  sendInternalAlertEmail,
  sendInvoiceEmailNotification,
  sendInvoicePaidConfirmationEmail,
  sendNewOrderStaffNotification,
  sendOrderReceivedEmail,
  sendOrderShippingStatusEmail,
  sendOrderStatusEmail,
  sendTasterAssignmentEmail,
  sendTastingReportReceivedEmail,
  sendTastingStatusEmail,
  sendWelcomeEmail,
  sendWholesaleRequestNotification,
} from '@/lib/resend/client'
import type { NotificationEvent, NotificationEventPayloads } from '../events'

export async function handleEmailChannel<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventPayloads[E],
): Promise<void> {
  switch (event) {
    case 'order.received': {
      const p = payload as NotificationEventPayloads['order.received']
      await Promise.all([
        sendOrderReceivedEmail({
          to: p.customerEmails,
          companyName: p.companyName,
          orderId: p.orderId,
          total: p.total,
        }),
        sendNewOrderStaffNotification({
          companyName: p.companyName,
          orderId: p.orderId,
          total: p.total,
          purchaseUnit: p.purchaseUnit,
          placedBy: p.placedBy,
        }),
      ])
      break
    }

    case 'order.status_changed': {
      const p = payload as NotificationEventPayloads['order.status_changed']
      await sendOrderStatusEmail({
        to: p.customerEmails,
        companyName: p.companyName,
        orderId: p.orderId,
        status: p.status,
      })
      break
    }

    case 'order.shipping_status_changed': {
      const p = payload as NotificationEventPayloads['order.shipping_status_changed']
      await sendOrderShippingStatusEmail({
        to: p.customerEmails,
        companyName: p.companyName,
        orderId: p.orderId,
        status: p.status,
      })
      break
    }

    case 'invoice.created': {
      const p = payload as NotificationEventPayloads['invoice.created']
      await sendInvoiceEmailNotification({
        to: p.customerEmail,
        invoiceNumber: p.invoiceNumber,
        companyName: p.companyName,
        total: p.total,
        invoiceUrl: p.invoiceUrl,
      })
      break
    }

    case 'invoice.paid': {
      const p = payload as NotificationEventPayloads['invoice.paid']
      await sendInvoicePaidConfirmationEmail({
        to: p.notifyEmails,
        companyName: p.companyName,
        invoiceNumber: p.invoiceNumber,
        total: p.total,
      })
      break
    }

    case 'delivery.completed': {
      const p = payload as NotificationEventPayloads['delivery.completed']
      await sendDeliveryCompletedEmail({
        to: p.customerEmail,
        companyName: p.companyName,
        deliveryDate: p.deliveryDate,
        proofOfDeliveryUrl: p.proofOfDeliveryUrl,
        shelfPhotoUrl: p.shelfPhotoUrl,
      })
      break
    }

    case 'delivery.driver_assigned': {
      const p = payload as NotificationEventPayloads['delivery.driver_assigned']
      await sendDriverDeliveryAssignmentEmail({
        to: p.driverEmail,
        driverName: p.driverName,
        weekStartDate: p.weekStartDate,
        stopCount: p.stopCount,
      })
      break
    }

    case 'wholesale_request.received': {
      const p = payload as NotificationEventPayloads['wholesale_request.received']
      await sendWholesaleRequestNotification({
        businessName: p.businessName,
        businessEmail: p.businessEmail,
        businessType: p.businessType,
        phone: p.phone,
        phoneNormalized: p.phoneNormalized,
        smsOptIn: p.smsOptIn,
      })
      break
    }

    case 'tasting.taster_assigned': {
      const p = payload as NotificationEventPayloads['tasting.taster_assigned']
      await sendTasterAssignmentEmail({
        to: p.tasterEmail,
        tasterName: p.tasterName,
        storeName: p.storeName,
        scheduledAt: p.scheduledAt,
        endAt: p.endAt,
        notes: p.notes,
      })
      break
    }

    case 'tasting.status_changed': {
      const p = payload as NotificationEventPayloads['tasting.status_changed']
      await sendTastingStatusEmail({
        to: p.tasterEmail,
        storeName: p.storeName,
        status: p.status,
        scheduledAt: p.scheduledAt,
      })
      break
    }

    case 'tasting.report_received': {
      const p = payload as NotificationEventPayloads['tasting.report_received']
      await sendTastingReportReceivedEmail({
        to: p.adminEmail,
        tasterName: p.tasterName,
        storeName: p.storeName,
      })
      break
    }

    case 'user.welcomed': {
      const p = payload as NotificationEventPayloads['user.welcomed']
      await sendWelcomeEmail({
        to: p.email,
        name: p.name,
        password: p.password,
        role: p.role,
      })
      break
    }
  }
}
