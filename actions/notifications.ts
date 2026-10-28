'use server'

import { and, eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { notificationsLog, smsThreads, contactEmails, contacts } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { sendSms, sendSmsWithReceipt } from '@/lib/telnyx/client'
import { Resend } from 'resend'
import { z } from 'zod'
import { emailIdentity, escapeEmailHtml } from '@/lib/resend/contact-email'
import { revalidatePath } from 'next/cache'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function getContactEmailIdentity() {
  await requireAdminOrStaff()
  return emailIdentity(process.env)
}

export async function saveContactEmailDraft(contactId: string, id: string, subject: string, body: string) {
  const session = await requireAdminOrStaff()
  if (!z.uuid().safeParse(contactId).success || !z.uuid().safeParse(id).success || subject.length > 998 || body.length > 100000) return { error: 'Invalid draft.' }
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact?.email) return { error: 'Contact has no email.' }
  const identity = emailIdentity(process.env)
  try {
    await db.insert(contactEmails).values({ id, actorUserId: session.user.id, contactId, accountId: contact.customerId, sender: identity.sender ?? 'Not configured', replyTo: identity.replyTo, recipient: contact.email, subject, body, status: 'draft' }).onConflictDoUpdate({ target: contactEmails.id, set: { subject, body }, setWhere: and(eq(contactEmails.actorUserId, session.user.id), eq(contactEmails.status, 'draft')) })
    return { success: true }
  } catch { return { error: 'Draft could not be saved.' } }
}

export async function sendQuickEmail(to: string, recipientName: string, subject: string, body: string, requestId: string = crypto.randomUUID(), contactId?: string) {
  const session = await requireAdminOrStaff()
  const parsed = z.object({ to: z.email(), subject: z.string().trim().min(1).max(998), body: z.string().trim().min(1).max(100000), requestId: z.uuid(), contactId: z.uuid().optional() }).safeParse({ to, subject, body, requestId, contactId })
  if (!parsed.success) return { error: 'Enter a valid recipient, subject, and message.' }
  if (!resend) return { error: 'Email service is not configured.' }
  const identity = emailIdentity(process.env)
  if (!identity.sender) return { error: 'RESEND_FROM_EMAIL is not configured.' }
  let accountId: string | null = null
  if (contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact || contact.email?.toLowerCase() !== to.toLowerCase()) return { error: 'Contact email changed. Reload before sending.' }
    accountId = contact.customerId
  }
  try {
    let [claimed] = await db.insert(contactEmails).values({ id: requestId, actorUserId: session.user.id, contactId, accountId, sender: identity.sender, replyTo: identity.replyTo, recipient: to, subject, body }).onConflictDoNothing().returning()
    if (!claimed) {
      const [existing] = await db.select().from(contactEmails).where(and(eq(contactEmails.id, requestId), eq(contactEmails.actorUserId, session.user.id))).limit(1)
      if (!existing || existing.recipient !== to || existing.contactId !== (contactId ?? null)) return { error: 'This request ID has already been used. Start a new message.' }
      if (existing.status === 'draft') {
        ;[claimed] = await db.update(contactEmails).set({ status: 'queued', subject, body, sender: identity.sender, replyTo: identity.replyTo, createdAt: new Date() }).where(and(eq(contactEmails.id, requestId), eq(contactEmails.actorUserId, session.user.id), eq(contactEmails.status, 'draft'))).returning()
        if (!claimed) return { error: 'This message is already being sent. Check history.' }
      } else {
        if (existing.subject !== subject || existing.body !== body) return { error: 'This request ID has already been used. Start a new message.' }
        return existing.status === 'accepted' || existing.status === 'delivered' ? { success: true } : { error: existing.error ?? 'Send is pending or unconfirmed. Check communication history before sending again.' }
      }
    }
    let response
    try {
      response = await resend.emails.send({ from: identity.sender, replyTo: identity.replyTo ?? undefined, to, subject, tags: [{ name: 'contact_email_id', value: requestId }], text: body, html: `<div style="white-space:pre-wrap">${escapeEmailHtml(body)}</div>` }, { idempotencyKey: `contact-email/${requestId}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider request interrupted.'
      await db.update(contactEmails).set({ status: 'unknown', error: message }).where(eq(contactEmails.id, requestId))
      return { error: 'Provider outcome is unconfirmed. Check history before attempting another send.' }
    }
    if (response.error || !response.data?.id) {
      const message = response.error?.message ?? 'Provider did not accept the message.'
      await db.update(contactEmails).set({ status: 'failed', error: message }).where(eq(contactEmails.id, requestId))
      return { error: message }
    }
    await db.update(contactEmails).set({ status: 'accepted', providerMessageId: response.data.id }).where(and(eq(contactEmails.id, requestId), or(eq(contactEmails.status, 'queued'), eq(contactEmails.status, 'unknown'))))
    if (contactId) for (const mode of ['admin', 'staff']) revalidatePath(`/${mode}/crm/people/${contactId}`)
    if (accountId) for (const mode of ['admin', 'staff']) revalidatePath(`/${mode}/crm/${accountId}`)
    return { success: true }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not save email history.' } }
}

export async function sendDirectSms(to: string, recipientName: string, body: string) {
  const session = await requireAdminOrStaff()

  if (!to || !body.trim()) return { error: 'Phone number and message are required' }

  // Normalize phone: strip spaces/dashes/parens, ensure + prefix
  const normalized = to.replace(/[\s\-().]/g, '').replace(/^(\d{10})$/, '+1$1').replace(/^1(\d{10})$/, '+1$1')

  try {
    const providerMessageId = await sendSmsWithReceipt({ to: normalized, body, userId: session.user.id, contactName: recipientName || null })
    await db.insert(notificationsLog).values({
      userId: session.user.id,
      recipientPhone: normalized,
      recipientName: recipientName || null,
      type: 'sms',
      message: body,
      status: 'queued',
      providerMessageId,
    })
    return { success: true }
  } catch (err) {
    await db.insert(notificationsLog).values({
      userId: session.user.id,
      recipientPhone: normalized,
      recipientName: recipientName || null,
      type: 'sms',
      message: body,
      status: 'failed',
    })
    const message = err instanceof Error ? err.message : 'Failed to send SMS'
    return { error: message }
  }
}

export async function replyToSmsThread(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminOrStaff()
  const phone = (formData.get('phone') as string) || ''
  const contactName = (formData.get('contactName') as string) || ''
  const body = ((formData.get('body') as string) || '').trim()
  const mediaUrls = formData
    .getAll('mediaUrl')
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter(Boolean)

  if (!phone || (!body && mediaUrls.length === 0)) {
    return { error: 'Add a message or image before sending.' }
  }

  try {
    const [thread] = await db
      .select({ groupParticipants: smsThreads.groupParticipants })
      .from(smsThreads)
      .where(eq(smsThreads.phoneNumber, phone))
      .limit(1)

    const groupParticipants = thread?.groupParticipants ?? []
    const recipients = groupParticipants.length > 0 ? [phone, ...groupParticipants] : phone

    await sendSms({
      to: recipients,
      body,
      mediaUrls,
      userId: session.user.id,
      contactName: contactName || null,
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to send reply.' }
  }
}

export async function composeSmsThread(
  _prev: { error?: string; success?: boolean; phone?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; phone?: string }> {
  const session = await requireAdminOrStaff()
  const phone = (formData.get('phone') as string) || ''
  const contactName = (formData.get('contactName') as string) || ''
  const body = ((formData.get('body') as string) || '').trim()

  if (!phone || !body) {
    return { error: 'Select an account and enter a message.' }
  }

  try {
    await sendSms({
      to: phone,
      body,
      userId: session.user.id,
      contactName: contactName || null,
    })
    return { success: true, phone }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to send text.' }
  }
}
