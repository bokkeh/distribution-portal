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
