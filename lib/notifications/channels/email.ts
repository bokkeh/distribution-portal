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
import { checkEmailEnabled, getStaffEmailsForNotification } from '@/lib/notifications/recipients'
import type { NotificationEvent, NotificationEventPayloads } from '../events'

export async function handleEmailChannel<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventPayloads[E],
): Promise<void> {
  switch (event) {
    case 'order.received': {
      const p = payload as NotificationEventPayloads['order.received']

      // Customer — respect their email preference
      const customerEnabled = await checkEmailEnabled(p.userId)
      const customerEmails = customerEnabled ? p.customerEmails : []

      // Staff — role-based, preference-filtered; supplement with env-var external contacts
      const staffEmails = await getStaffEmailsForNotification(['admin', 'staff'])
      const externalStaffEmails = [
        process.env.ORDER_NOTIFY_KIM_EMAIL,
        process.env.ORDER_NOTIFY_KIM_EMAIL_2,
        process.env.ORDER_NOTIFY_KRISTEN_EMAIL,
      ].filter(Boolean) as string[]
      const allStaffEmails = [...new Set([...staffEmails, ...externalStaffEmails])]

      await Promise.all([
        customerEmails.length
          ? sendOrderReceivedEmail({
              to: customerEmails,
              companyName: p.companyName,
              orderId: p.orderId,
              total: p.total,
            })
          : Promise.resolve(),
        allStaffEmails.length
          ? sendNewOrderStaffNotification({
              to: allStaffEmails,
              companyName: p.companyName,
              orderId: p.orderId,
              total: p.total,
              purchaseUnit: p.purchaseUnit,
              placedBy: p.placedBy,
            })
          : Promise.resolve(),
      ])
      break
    }

    case 'order.status_changed': {
      const p = payload as NotificationEventPayloads['order.status_changed']
      if (!(await checkEmailEnabled(p.userId))) break
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
      if (!(await checkEmailEnabled(p.userId))) break
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
      if (!(await checkEmailEnabled(p.userId))) break
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
      // Notifies admin/staff that a payment came in — role-based, preference-filtered
      const staffEmails = await getStaffEmailsForNotification(['admin', 'staff'])
      if (!staffEmails.length) break
      const p = payload as NotificationEventPayloads['invoice.paid']
      await sendInvoicePaidConfirmationEmail({
        to: staffEmails,
        companyName: p.companyName,
        invoiceNumber: p.invoiceNumber,
        total: p.total,
      })
      break
    }

    case 'delivery.completed': {
      const p = payload as NotificationEventPayloads['delivery.completed']
      if (!p.customerEmail) break
      if (!(await checkEmailEnabled(p.userId))) break
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
      if (!(await checkEmailEnabled(p.userId))) break
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
      // Admin-only: role-based + configured env-var address
      const adminEmails = await getStaffEmailsForNotification(['admin'])
      const envEmail = process.env.WHOLESALE_REQUEST_NOTIFICATION_EMAIL
      const recipients = [...new Set([...adminEmails, ...(envEmail ? [envEmail] : [])])]
      if (!recipients.length) break
      await sendWholesaleRequestNotification({
        to: recipients,
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
      if (!(await checkEmailEnabled(p.userId))) break
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
      if (!p.tasterEmail) break
      if (!(await checkEmailEnabled(p.userId))) break
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
      const tasterEmailEnabled = await checkEmailEnabled(p.userId)
      const kristenEmail = process.env.ORDER_NOTIFY_KRISTEN_EMAIL?.trim()

      await Promise.all([
        tasterEmailEnabled && p.tasterEmail
          ? sendTastingReportReceivedEmail({
              to: p.tasterEmail,
              tasterName: p.tasterName,
              storeName: p.storeName,
            })
          : Promise.resolve(),
        kristenEmail
          ? sendInternalAlertEmail({
              to: [kristenEmail],
              subject: `Tasting report submitted - ${p.storeName}`,
              title: 'Tasting report submitted',
              body: `${p.tasterName || 'A taster'} submitted a report for ${p.storeName}.`,
              href: `/admin/tastings/${p.tastingId}`,
            })
          : Promise.resolve(),
      ])
      break
    }

    case 'tasting.taster_declined': {
      // Notify admin/staff — role-based, preference-filtered
      const teamEmails = await getStaffEmailsForNotification(['admin', 'staff'])
      if (!teamEmails.length) break
      const p = payload as NotificationEventPayloads['tasting.taster_declined']
      await sendInternalAlertEmail({
        to: teamEmails,
        subject: `Tasting declined - ${p.eventName}`,
        title: 'Tasting declined',
        body: `${p.declinedByName} declined ${p.eventName} scheduled for ${p.scheduledAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}.`,
        href: '/admin/tastings',
      })
      break
    }

    case 'user.welcomed': {
      // Transactional — always send regardless of preference (account creation)
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
