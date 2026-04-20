'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { activityEvents, customerAccounts, users, wholesaleAccountRequests } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { sendWholesalerApprovalEmail, sendWholesalerInvitationEmail } from '@/lib/resend/client'

export async function updateWholesaleRequestWorkflow(formData: FormData) {
  const session = await requireAdmin()
  const requestId = ((formData.get('requestId') as string) || '').trim()
  const assigneeUserId = ((formData.get('assigneeUserId') as string) || '').trim() || null
  const attachedAccountSelection = ((formData.get('attachedAccountSelection') as string) || '').trim()
  const status = ((formData.get('status') as string) || 'new').trim()
  const notes = ((formData.get('notes') as string) || '').trim()

  if (!requestId) {
    return { error: 'Missing request id.' }
  }

  const [request] = await db
    .select({
      id: wholesaleAccountRequests.id,
      businessName: wholesaleAccountRequests.businessName,
      businessEmail: wholesaleAccountRequests.businessEmail,
    })
    .from(wholesaleAccountRequests)
    .where(eq(wholesaleAccountRequests.id, requestId))
    .limit(1)

  if (!request) {
    return { error: 'Wholesale request not found.' }
  }

  const attachedAccountIdMatch = attachedAccountSelection.match(/\[([0-9a-f-]{36})\]$/i)
  const attachedAccountId = attachedAccountIdMatch?.[1] ?? null
  let attachedAccountName: string | null = null

  if (attachedAccountSelection && !attachedAccountId) {
    return { error: 'Choose an attached CRM account from the suggested list.' }
  }

  if (attachedAccountId) {
    const [account] = await db
      .select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, attachedAccountId))
      .limit(1)

    if (!account) {
      return { error: 'The selected CRM account could not be found.' }
    }

    attachedAccountName = account.companyName
  }

  const [latestWorkflowEvent] = await db
    .select({ metadata: activityEvents.metadata })
    .from(activityEvents)
    .where(and(
      eq(activityEvents.entityType, 'wholesale_request'),
      eq(activityEvents.entityId, request.id),
      eq(activityEvents.kind, 'wholesale_request_updated'),
    ))
    .orderBy(desc(activityEvents.createdAt))
    .limit(1)

  const previousMetadata = latestWorkflowEvent?.metadata && typeof latestWorkflowEvent.metadata === 'object'
    ? latestWorkflowEvent.metadata as Record<string, unknown>
    : {}
  const previousStatus = typeof previousMetadata.status === 'string' ? previousMetadata.status : 'new'
  const previousAttachedAccountId = typeof previousMetadata.attachedAccountId === 'string' ? previousMetadata.attachedAccountId : null

  let assigneeName: string | null = null
  if (assigneeUserId) {
    const [assignee] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, assigneeUserId))
      .limit(1)
    assigneeName = assignee?.name ?? null
  }

  const titles: Record<string, string> = {
    new: 'Wholesale request marked new',
    reviewing: 'Wholesale request under review',
    approved: 'Wholesale request approved',
    rejected: 'Wholesale request rejected',
    escalated: 'Wholesale request escalated',
    resolved: 'Wholesale request resolved',
  }

  await logActivityEvent({
    entityType: 'wholesale_request',
    entityId: request.id,
    actorUserId: session.user.id,
    relatedUserId: assigneeUserId,
    kind: 'wholesale_request_updated',
    title: titles[status] ?? 'Wholesale request updated',
    body: [
      assigneeName ? `Owner: ${assigneeName}` : 'Owner: Unassigned',
      attachedAccountName ? `CRM account: ${attachedAccountName}` : attachedAccountSelection ? null : 'CRM account: Unattached',
      notes ? `Notes: ${notes}` : null,
    ].filter(Boolean).join(' | '),
    metadata: {
      status,
      assigneeUserId,
      assigneeName,
      attachedAccountId,
      attachedAccountName,
      notes,
    },
  })

  if (status === 'approved' && (previousStatus !== 'approved' || previousAttachedAccountId !== attachedAccountId)) {
    await sendWholesalerApprovalEmail({
      to: request.businessEmail,
      businessName: request.businessName,
      senderName: session.user.name ?? 'The AHAWC Team',
      personalMessage: notes || null,
    })

    await logActivityEvent({
      entityType: 'wholesale_request',
      entityId: request.id,
      actorUserId: session.user.id,
      kind: 'wholesale_request_approval_sent',
      title: 'Wholesale approval email sent',
      body: `Approval email sent to ${request.businessEmail}.`,
      metadata: {
        email: request.businessEmail,
      },
    })
  }

  revalidatePath('/admin/wholesale-requests')
  revalidatePath('/admin/attention')
  return { success: true }
}

export async function sendWholesalerInvitation(formData: FormData) {
  const session = await requireAdminOrStaff()
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const personalMessage = ((formData.get('personalMessage') as string) || '').trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  await sendWholesalerInvitationEmail({
    to: email,
    senderName: session.user.name ?? 'The AHAWC Team',
    personalMessage,
  })

  return { success: true }
}

export async function resendWholesalerApprovalEmail(formData: FormData) {
  const session = await requireAdminOrStaff()
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const businessName = ((formData.get('businessName') as string) || '').trim() || 'Your business'
  const personalMessage = ((formData.get('personalMessage') as string) || '').trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  await sendWholesalerApprovalEmail({
    to: email,
    businessName,
    senderName: session.user.name ?? 'The AHAWC Team',
    personalMessage,
  })

  return { success: true }
}
