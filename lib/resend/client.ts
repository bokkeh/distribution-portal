import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvoiceEmailNotification({
  to,
  invoiceNumber,
  companyName,
  total,
  invoiceUrl,
}: {
  to: string
  invoiceNumber: string
  companyName: string
  total: string
  invoiceUrl: string
}): Promise<void> {
  if (!to) return

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com',
      to,
      subject: `Invoice ${invoiceNumber} from AHAWC`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e40af; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AHAWC</h1>
            <p style="color: #bfdbfe; margin: 4px 0 0;">Distribution Portal</p>
          </div>
          <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1e293b;">Invoice ${invoiceNumber}</h2>
            <p style="color: #475569;">Dear ${companyName},</p>
            <p style="color: #475569;">Please find your invoice attached below.</p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Invoice Total</p>
              <p style="margin: 4px 0 0; font-size: 28px; font-weight: bold; color: #1e293b;">$${parseFloat(total).toFixed(2)}</p>
            </div>
            <a href="${invoiceUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              View & Pay Invoice
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">AHAWC Distribution · Texas</p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error('Resend email failed:', error)
  }
}

export async function sendSampleCaseAlert({
  staffName,
  productName,
  sku,
  previousQty,
  newQty,
  delta,
}: {
  staffName: string
  productName: string
  sku: string
  previousQty: number
  newQty: number
  delta: number
}): Promise<void> {
  const direction = delta > 0 ? `+${delta}` : String(delta)
  const action = delta > 0 ? 'added' : 'removed'

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com',
      to: 'kris@ahawc.com',
      subject: `Sample Case Adjustment — ${productName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">AHAWC · Sample Case Alert</h1>
          </div>
          <div style="background: #f8fafc; padding: 28px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #475569; margin: 0 0 16px;">
              <strong>${staffName}</strong> ${action} <strong>${Math.abs(delta)}</strong> sample case(s) for:
            </p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1e293b;">${productName}</p>
              <p style="margin: 0; font-size: 13px; color: #64748b; font-family: monospace;">SKU: ${sku}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Previous quantity</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${previousQty} cases</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Adjustment</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${delta > 0 ? '#16a34a' : '#dc2626'};">${direction} cases</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 10px 0 6px; color: #64748b; font-weight: 600;">New quantity</td>
                <td style="padding: 10px 0 6px; text-align: right; font-weight: 700; font-size: 16px; color: #1e293b;">${newQty} cases</td>
              </tr>
            </table>
            <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0;">AHAWC Distribution Portal · Sent automatically on sample case adjustment</p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error('Sample case alert email failed:', error)
  }
}

export async function sendWelcomeEmail({
  to,
  name,
  password,
  role,
}: {
  to: string
  name: string
  password: string
  role: string
}): Promise<void> {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com',
      to,
      subject: 'Welcome to AHAWC Distribution Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to AHAWC Portal, ${name}!</h2>
          <p>Your account has been created with the following credentials:</p>
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p><strong>Role:</strong> ${role}</p>
          <p>Please log in and change your password.</p>
          <a href="${process.env.NEXTAUTH_URL}/login">Log In Now</a>
        </div>
      `,
    })
  } catch (error) {
    console.error('Resend welcome email failed:', error)
  }
}

export async function sendWholesaleRequestNotification({
  businessName,
  businessEmail,
  phone,
  phoneNormalized,
  smsOptIn,
}: {
  businessName: string
  businessEmail: string
  phone: string
  phoneNormalized: string
  smsOptIn: boolean
}): Promise<void> {
  const to = process.env.WHOLESALE_REQUEST_NOTIFICATION_EMAIL ?? 'admin@ahawc.com'

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com',
      to,
      subject: `Wholesale account request - ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <div style="background: #0f2d5a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">New wholesale account request</h1>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 16px; color: #475569;">A new request was submitted from the public marketing form.</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #64748b;">Business</td><td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${businessName}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Email</td><td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${businessEmail}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Phone</td><td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${phone}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Normalized</td><td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${phoneNormalized}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">SMS opt-in</td><td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${smsOptIn ? 'Yes' : 'No'}</td></tr>
            </table>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error('Wholesale request email failed:', error)
  }
}
