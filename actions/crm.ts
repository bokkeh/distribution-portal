'use server'

import { db } from '@/db'
import { accountPreferences, activityEvents, contacts, customerAccounts, deliveryStops, invoices, orders, salesMembers, salesRouteStops, smsThreads, tastings, users } from '@/db/schema'
import { requireAdminOrStaff, requireRole } from '@/lib/auth/session'
import { geocodeAddress } from '@/lib/maps/geocode'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getHubSpotCompanyContacts, upsertHubSpotContact, getHubSpotCompanies, updateHubSpotCompany } from '@/lib/hubspot/client'
import { logActivityEvent } from '@/lib/activity/log'
import { createUserNotification } from '@/lib/notifications/in-app'
import { normalizeAccountGeography } from '@/lib/pricing/geographic-service'
import { isGeocodeActionRateLimited } from '@/lib/auth/rate-limit'

const CRM_EDITOR_ROLES = ['admin', 'staff', 'sales_rep', 'sales_manager'] as const

function getSessionRoles(session: Awaited<ReturnType<typeof requireRole>>) {
  return new Set((session.user.roles ?? [session.user.role]).filter(Boolean) as string[])
}

async function requireEditableAccountAccess(accountId: string) {
  const session = await requireRole(...CRM_EDITOR_ROLES)
  const roles = getSessionRoles(session)
  const canManageAny = roles.has('admin') || roles.has('staff') || roles.has('sales_manager')

  const [account] = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) {
    throw new Error('Account not found.')
  }

  if (!canManageAny) {
    const [member] = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member) {
      throw new Error('No sales member profile found.')
    }

    if (account.assignedSalesRepId !== member.id) {
      throw new Error('You are not assigned to this account.')
    }
  }

  return { session, roles, account, canManageAny }
}

async function requireEditableContactAccess(contactId: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)

  if (!contact) {
    throw new Error('Contact not found.')
  }

  const access = await requireEditableAccountAccess(contact.customerId)
  return { ...access, contact }
}

export async function updateDealStage(accountId: string, dealStage: string) {
  await requireAdminOrStaff()
  await db.update(customerAccounts).set({ dealStage }).where(eq(customerAccounts.id, accountId))
  revalidatePath('/admin/crm')
  revalidatePath('/staff/crm')
  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
}

function combineTextValues(...values: Array<string | null | undefined>) {
  const parts = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  return parts.length ? Array.from(new Set(parts)).join('\n') : null
}

function combineContactName(firstname: string | null, lastname: string | null) {
  return [firstname?.trim(), lastname?.trim()].filter(Boolean).join(' ').trim()
}

function validateWebsiteUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Website must use http or https.')
    }
    return value
  } catch {
    throw new Error('Website must be a valid http or https URL.')
  }
}

async function syncHubSpotCompanyContactsToLocalAccount(accountId: string, hubspotCompanyId: string) {
  const hubspotContacts = await getHubSpotCompanyContacts(hubspotCompanyId)
  if (!hubspotContacts.length) return { imported: 0, updated: 0 }

  const existingContacts = await db.select().from(contacts).where(eq(contacts.customerId, accountId))
  const hasPrimaryContact = existingContacts.some(c => c.isPrimary)
  const byEmail = new Map(existingContacts.filter(c => c.email).map(c => [c.email!, c]))
  const byHubspotId = new Map(existingContacts.filter(c => c.hubspotContactId).map(c => [c.hubspotContactId!, c]))

  const toInsert: (typeof contacts.$inferInsert)[] = []
  const toUpdate: { id: string; values: Partial<typeof contacts.$inferInsert> }[] = []

  for (const hubspotContact of hubspotContacts) {
    const name = combineContactName(hubspotContact.firstname, hubspotContact.lastname) || 'HubSpot contact'
    const existingContact = (hubspotContact.email ? byEmail.get(hubspotContact.email) : null)
      ?? byHubspotId.get(hubspotContact.id)

    if (existingContact) {
      toUpdate.push({
        id: existingContact.id,
        values: { name, email: hubspotContact.email, phone: hubspotContact.phone, title: hubspotContact.jobtitle, hubspotContactId: hubspotContact.id },
      })
    } else {
      toInsert.push({
        customerId: accountId,
        name,
        email: hubspotContact.email,
        phone: hubspotContact.phone,
        title: hubspotContact.jobtitle,
        isPrimary: !hasPrimaryContact && toInsert.length === 0,
        hubspotContactId: hubspotContact.id,
      })
    }
  }

  if (toInsert.length > 0) {
    await db.insert(contacts).values(toInsert)
  }
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(({ id, values }) => db.update(contacts).set(values).where(eq(contacts.id, id)))
    )
  }

  return { imported: toInsert.length, updated: toUpdate.length }
}

export async function mergeCustomerAccounts(formData: FormData) {
  const session = await requireAdminOrStaff()

  const sourceAccountId = (formData.get('sourceAccountId') as string | null)?.trim()
  const targetAccountId = (formData.get('targetAccountId') as string | null)?.trim()

  if (!sourceAccountId || !targetAccountId) {
    throw new Error('Both source and target accounts are required.')
  }
  if (sourceAccountId === targetAccountId) {
    throw new Error('Choose two different accounts to merge.')
  }

  const [sourceAccount] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, sourceAccountId)).limit(1)
  const [targetAccount] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, targetAccountId)).limit(1)

  if (!sourceAccount || !targetAccount) {
    throw new Error('One of the accounts could not be found.')
  }

  await db.update(contacts).set({ customerId: targetAccountId }).where(eq(contacts.customerId, sourceAccountId))
  await db.update(orders).set({ customerId: targetAccountId }).where(eq(orders.customerId, sourceAccountId))
  await db.update(invoices).set({ customerId: targetAccountId }).where(eq(invoices.customerId, sourceAccountId))
  await db.update(tastings).set({ customerId: targetAccountId }).where(eq(tastings.customerId, sourceAccountId))
  await db.update(deliveryStops).set({ customerId: targetAccountId }).where(eq(deliveryStops.customerId, sourceAccountId))
  await db.update(salesRouteStops).set({ customerId: targetAccountId }).where(eq(salesRouteStops.customerId, sourceAccountId))
  await db.update(smsThreads).set({ customerId: targetAccountId }).where(eq(smsThreads.customerId, sourceAccountId))
  await db.update(activityEvents).set({ entityId: targetAccountId }).where(eq(activityEvents.entityId, sourceAccountId))

  const mergedFields = {
    userId: targetAccount.userId ?? sourceAccount.userId,
    contactName: targetAccount.contactName ?? sourceAccount.contactName,
    address: targetAccount.address ?? sourceAccount.address,
    city: targetAccount.city ?? sourceAccount.city,
    state: targetAccount.state ?? sourceAccount.state,
    zip: targetAccount.zip ?? sourceAccount.zip,
    phone: targetAccount.phone ?? sourceAccount.phone,
    email: targetAccount.email ?? sourceAccount.email,
    businessType: targetAccount.businessType ?? sourceAccount.businessType,
    dcAbraNumber: targetAccount.dcAbraNumber ?? sourceAccount.dcAbraNumber,
    liquorLicenseNumber: targetAccount.liquorLicenseNumber ?? sourceAccount.liquorLicenseNumber,
    liquorLicenseState: targetAccount.liquorLicenseState ?? sourceAccount.liquorLicenseState,
    liquorLicenseExpiration: targetAccount.liquorLicenseExpiration ?? sourceAccount.liquorLicenseExpiration,
    liquorLicenseUrl: targetAccount.liquorLicenseUrl ?? sourceAccount.liquorLicenseUrl,
    hubspotContactId: targetAccount.hubspotContactId ?? sourceAccount.hubspotContactId,
    hubspotCompanyId: targetAccount.hubspotCompanyId ?? sourceAccount.hubspotCompanyId,
    businessEmail: targetAccount.businessEmail ?? sourceAccount.businessEmail,
    businessPhone: targetAccount.businessPhone ?? sourceAccount.businessPhone,
    notificationPreference: targetAccount.notificationPreference ?? sourceAccount.notificationPreference,
    pocName: targetAccount.pocName ?? sourceAccount.pocName,
    pocPhone: targetAccount.pocPhone ?? sourceAccount.pocPhone,
    pocEmail: targetAccount.pocEmail ?? sourceAccount.pocEmail,
    hoursOfOperation: combineTextValues(targetAccount.hoursOfOperation, sourceAccount.hoursOfOperation),
    preferredDeliveryDays: combineTextValues(targetAccount.preferredDeliveryDays, sourceAccount.preferredDeliveryDays),
    preferredDeliveryTimes: combineTextValues(targetAccount.preferredDeliveryTimes, sourceAccount.preferredDeliveryTimes),
    additionalLocations: combineTextValues(targetAccount.additionalLocations, sourceAccount.additionalLocations),
    website: targetAccount.website ?? sourceAccount.website,
  }

  await db.update(customerAccounts).set(mergedFields).where(eq(customerAccounts.id, targetAccountId))

  const [sourcePrefs] = await db.select().from(accountPreferences).where(eq(accountPreferences.accountId, sourceAccountId)).limit(1)
  if (sourcePrefs) {
    const [targetPrefs] = await db.select().from(accountPreferences).where(eq(accountPreferences.accountId, targetAccountId)).limit(1)
    if (!targetPrefs) {
      await db.insert(accountPreferences).values({
        accountId: targetAccountId,
        timeZone: sourcePrefs.timeZone,
        quietHoursStart: sourcePrefs.quietHoursStart,
        quietHoursEnd: sourcePrefs.quietHoursEnd,
      })
    }
    await db.delete(accountPreferences).where(eq(accountPreferences.accountId, sourceAccountId))
  }

  await logActivityEvent({
    entityType: 'account',
    entityId: targetAccountId,
    actorUserId: session.user.id,
    kind: 'account_merged',
    title: 'Duplicate account merged',
    body: `${sourceAccount.companyName} was merged into ${targetAccount.companyName}.`,
    metadata: {
      sourceAccountId,
      targetAccountId,
    },
  })

  await db.delete(customerAccounts).where(eq(customerAccounts.id, sourceAccountId))

  revalidatePath('/admin/crm')
  revalidatePath('/staff/crm')
  revalidatePath(`/admin/crm/${targetAccountId}`)
  revalidatePath(`/staff/crm/${targetAccountId}`)
}

export async function mergeContacts(formData: FormData) {
  const session = await requireAdminOrStaff()

  const sourceContactId = (formData.get('sourceContactId') as string | null)?.trim()
  const targetContactId = (formData.get('targetContactId') as string | null)?.trim()

  if (!sourceContactId || !targetContactId) {
    throw new Error('Both source and target contacts are required.')
  }
  if (sourceContactId === targetContactId) {
    throw new Error('Choose two different people to merge.')
  }

  const [sourceContact] = await db.select().from(contacts).where(eq(contacts.id, sourceContactId)).limit(1)
  const [targetContact] = await db.select().from(contacts).where(eq(contacts.id, targetContactId)).limit(1)
  if (!sourceContact || !targetContact) {
    throw new Error('One of the contacts could not be found.')
  }

  await db.update(contacts).set({
    customerId: targetContact.customerId,
    name: targetContact.name || sourceContact.name,
    email: targetContact.email ?? sourceContact.email,
    phone: targetContact.phone ?? sourceContact.phone,
    phoneType: targetContact.phoneType ?? sourceContact.phoneType,
    preferredContact: targetContact.preferredContact ?? sourceContact.preferredContact,
    title: targetContact.title ?? sourceContact.title,
    isPrimary: targetContact.isPrimary || sourceContact.isPrimary,
    hubspotContactId: targetContact.hubspotContactId ?? sourceContact.hubspotContactId,
    notes: combineTextValues(targetContact.notes, sourceContact.notes),
  }).where(eq(contacts.id, targetContactId))

  await logActivityEvent({
    entityType: 'account',
    entityId: targetContact.customerId,
    actorUserId: session.user.id,
    kind: 'contact_merged',
    title: 'Duplicate contact merged',
    body: `${sourceContact.name} was merged into ${targetContact.name}.`,
    metadata: {
      sourceContactId,
      targetContactId,
    },
  })

  await db.delete(contacts).where(eq(contacts.id, sourceContactId))

  revalidatePath('/admin/crm')
  revalidatePath('/staff/crm')
  revalidatePath(`/admin/crm/${targetContact.customerId}`)
  revalidatePath(`/admin/crm/${targetContact.customerId}/contacts`)
  revalidatePath(`/staff/crm/${targetContact.customerId}`)
  revalidatePath(`/staff/crm/${targetContact.customerId}/contacts`)
}

export async function toggleStarAccount(accountId: string, starred: boolean) {
  await requireAdminOrStaff()
  await db.update(customerAccounts).set({ starred }).where(eq(customerAccounts.id, accountId))
  revalidatePath('/admin/crm')
}

export async function syncToHubSpot(accountId: string) {
  await requireAdminOrStaff()

  const [account] = await db.select({
    hubspotCompanyId: customerAccounts.hubspotCompanyId,
    email: customerAccounts.email,
    phone: customerAccounts.phone,
    companyName: customerAccounts.companyName,
    contactName: customerAccounts.contactName,
    hubspotContactId: customerAccounts.hubspotContactId,
    creditLimit: customerAccounts.creditLimit,
    paymentTerms: customerAccounts.paymentTerms,
    balance: customerAccounts.balance,
    city: customerAccounts.city,
    state: customerAccounts.state,
  }).from(customerAccounts).where(eq(customerAccounts.id, accountId))
  if (!account) return

  const accountContacts = await db.select().from(contacts).where(eq(contacts.customerId, accountId))
  const primaryContact = accountContacts.find(c => c.isPrimary) ?? accountContacts[0]

  const hubspotId = await upsertHubSpotContact({
    email: account.email ?? primaryContact?.email ?? '',
    firstname: primaryContact?.name?.split(' ')[0] ?? account.companyName,
    lastname: primaryContact?.name?.split(' ').slice(1).join(' ') ?? '',
    company: account.companyName,
    phone: account.phone ?? primaryContact?.phone ?? '',
    city: account.city ?? '',
    state: account.state ?? '',
    credit_limit: account.creditLimit ?? '0',
    payment_terms: account.paymentTerms ?? 'PREPAID',
    account_balance: account.balance ?? '0',
  })

  if (hubspotId) {
    await db.update(customerAccounts)
      .set({ hubspotContactId: hubspotId })
      .where(eq(customerAccounts.id, accountId))
  }

  if (account.hubspotCompanyId) {
    await syncHubSpotCompanyContactsToLocalAccount(accountId, account.hubspotCompanyId)
  }

  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
  revalidatePath(`/admin/crm/${accountId}/contacts`)
  revalidatePath(`/staff/crm/${accountId}/contacts`)
}

function revalidateContactPaths(customerId: string) {
  revalidatePath(`/admin/crm/${customerId}`)
  revalidatePath(`/admin/crm/${customerId}/contacts`)
  revalidatePath(`/staff/crm/${customerId}`)
  revalidatePath(`/staff/crm/${customerId}/contacts`)
  revalidatePath(`/sales/accounts/${customerId}`)
  revalidatePath(`/sales/accounts/${customerId}/contacts`)
}

export async function addContact(formData: FormData) {
  const customerId = formData.get('customerId') as string
  const { session } = await requireEditableAccountAccess(customerId)
  const name = formData.get('name') as string
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const phoneType = (formData.get('phoneType') as string) || null
  const preferredContact = (formData.get('preferredContact') as string) || null
  const title = (formData.get('title') as string)?.trim() || null
  const isPrimary = formData.get('isPrimary') === 'on'

  await db.insert(contacts).values({
    customerId, name,
    email,
    phone,
    phoneType: phoneType as 'mobile' | 'landline' | 'voip' | 'other' | null,
    preferredContact: preferredContact as 'email' | 'sms' | 'call' | null,
    title,
    isPrimary,
  })

  await logActivityEvent({
    entityType: 'account',
    entityId: customerId,
    actorUserId: session.user.id,
    kind: 'contact_added',
    title: 'Contact added',
    body: `${name} was added to the account contacts.`,
    metadata: {
      contactName: name,
      email,
      phone,
      preferredContact,
      isPrimary,
    },
  })

  revalidateContactPaths(customerId)
}

export async function updateContact(contactId: string, formData: FormData) {
  try {
    const { session, contact } = await requireEditableContactAccess(contactId)

    const name = (formData.get('name') as string)?.trim()
    const email = (formData.get('email') as string)?.trim() || null
    const phone = (formData.get('phone') as string)?.trim() || null
    const phoneType = (formData.get('phoneType') as string) || null
    const preferredContact = (formData.get('preferredContact') as string) || null
    const title = (formData.get('title') as string)?.trim() || null
    const isPrimary = formData.get('isPrimary') === 'on'

    const changedFields = [
      ['name', contact.name, name],
      ['email', contact.email, email],
      ['phone', contact.phone, phone],
      ['phoneType', contact.phoneType, phoneType],
      ['preferredContact', contact.preferredContact, preferredContact],
      ['title', contact.title, title],
      ['isPrimary', String(contact.isPrimary), String(isPrimary)],
    ].filter(([, previousValue, nextValue]) => (previousValue ?? null) !== (nextValue ?? null)).map(([field]) => field as string)

    await db.update(contacts).set({
      name,
      email,
      phone,
      phoneType: phoneType as 'mobile' | 'landline' | 'voip' | 'other' | null,
      preferredContact: preferredContact as 'email' | 'sms' | 'call' | null,
      title,
      isPrimary,
    }).where(eq(contacts.id, contactId))

    await logActivityEvent({
      entityType: 'account',
      entityId: contact.customerId,
      actorUserId: session.user.id,
      kind: 'contact_updated',
      title: 'Contact updated',
      body: changedFields.length
        ? `${contact.name} was updated. Changed: ${changedFields.join(', ')}.`
        : `${contact.name} was updated.`,
      metadata: {
        contactId,
        changedFields,
        before: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          phoneType: contact.phoneType,
          preferredContact: contact.preferredContact,
          title: contact.title,
          isPrimary: contact.isPrimary,
        },
        after: {
          name,
          email,
          phone,
          phoneType,
          preferredContact,
          title,
          isPrimary,
        },
      },
    })

    revalidateContactPaths(contact.customerId)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update contact.' }
  }
}

export async function deleteContact(contactId: string) {
  try {
    const { session, contact } = await requireEditableContactAccess(contactId)

    await db.delete(contacts).where(eq(contacts.id, contactId))

    await logActivityEvent({
      entityType: 'account',
      entityId: contact.customerId,
      actorUserId: session.user.id,
      kind: 'contact_deleted',
      title: 'Contact removed',
      body: `${contact.name} was removed from the account contacts.`,
      metadata: {
        contactId,
        contactName: contact.name,
        email: contact.email,
        phone: contact.phone,
      },
    })

    revalidateContactPaths(contact.customerId)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete contact.' }
  }
}

export async function importHubSpotCompany(hubspotCompanyId: string) {
  await requireAdminOrStaff()

  // Don't import if already linked
  const existing = await db.select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(eq(customerAccounts.hubspotCompanyId, hubspotCompanyId))
  if (existing.length > 0) return { error: 'Already imported' }

  const { companies } = await getHubSpotCompanies()
  const company = companies.find(c => c.id === hubspotCompanyId)
  if (!company) return { error: 'Company not found' }

  const safeWebsite = (() => { try { return validateWebsiteUrl(company.website) } catch { return null } })()

  const [createdAccount] = await db.insert(customerAccounts).values({
    companyName: company.name,
    contactName: null,
    address: company.address,
    city: company.city,
    state: company.state,
    zip: company.zip,
    phone: company.phone,
    website: safeWebsite,
    dcAbraNumber: null,
    hubspotCompanyId: company.id,
    creditLimit: '0',
    balance: '0',
    paymentTerms: 'NET30',
  }).returning({ id: customerAccounts.id })

  if (createdAccount) {
    await syncHubSpotCompanyContactsToLocalAccount(createdAccount.id, company.id)
    revalidateContactPaths(createdAccount.id)
  }

  revalidatePath('/admin/crm')
  return { success: true }
}

export async function updateHubSpotCompanyAction(
  hubspotId: string,
  localAccountId: string | null,
  data: {
    name: string
    phone: string
    address: string
    city: string
    state: string
    zip: string
    website: string
    industry: string
  }
): Promise<{ success: true } | { error: string }> {
  await requireAdminOrStaff()

  let safeWebsite: string | null
  try {
    safeWebsite = validateWebsiteUrl(data.website || null)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid website URL.' }
  }

  // Sync to HubSpot
  await updateHubSpotCompany(hubspotId, data)

  // Also update local account if imported
  if (localAccountId) {
    await db.update(customerAccounts).set({
      companyName: data.name,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      website: safeWebsite,
    }).where(eq(customerAccounts.id, localAccountId))
  }

  revalidatePath('/admin/crm')
  return { success: true }
}

export async function updateCustomerAccount(
  _prev: { error?: string; success?: boolean; changedFields?: string[] } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; changedFields?: string[] }> {
  try {
    const id = formData.get('id') as string
    const { session, roles, account: existingAccount } = await requireEditableAccountAccess(id)
    const canAssignSalesLead = roles.has('admin')
    const hubspotCompanyId = (formData.get('hubspotCompanyId') as string) || null
    const companyName = formData.get('companyName') as string
    const phone = (formData.get('phone') as string) || null
    const email = (formData.get('email') as string) || null
    const address = (formData.get('address') as string) || null
    const city = (formData.get('city') as string) || null
    const state = (formData.get('state') as string) || null
    const county = (formData.get('county') as string) || null
    const zip = (formData.get('zip') as string) || null
    const businessEmail = (formData.get('businessEmail') as string) || null
    const businessPhone = (formData.get('businessPhone') as string) || null
    const pocName = (formData.get('pocName') as string) || null
    const pocPhone = (formData.get('pocPhone') as string) || null
    const pocEmail = (formData.get('pocEmail') as string) || null
    const contactName = (formData.get('contactName') as string) || null
    const hoursOfOperation = (formData.get('hoursOfOperation') as string) || null
    const website = validateWebsiteUrl((formData.get('website') as string) || null)
    const dcAbraNumber = (formData.get('dcAbraNumber') as string) || null
    const businessType = (formData.get('businessType') as string) || null
    const creditLimit = formData.get('creditLimit') as string
    const paymentTerms = formData.get('paymentTerms') as string
    const requestedAssignedSalesRepId = ((formData.get('assignedSalesRepId') as string) || '').trim() || null
    const liquorLicenseNumber = (formData.get('liquorLicenseNumber') as string) || null
    const liquorLicenseState = (formData.get('liquorLicenseState') as string) || null
    const liquorLicenseExpiration = (formData.get('liquorLicenseExpiration') as string) || null
    const liquorLicenseUrl = (formData.get('liquorLicenseUrl') as string) || null
    const normalizedGeography = normalizeAccountGeography({ state, county })

    if (!canAssignSalesLead && requestedAssignedSalesRepId !== null && requestedAssignedSalesRepId !== existingAccount.assignedSalesRepId) {
      return { error: 'Only admins can assign a sales lead.' }
    }

    const assignedSalesRepId = canAssignSalesLead ? requestedAssignedSalesRepId : existingAccount.assignedSalesRepId
    const assignmentChanged = assignedSalesRepId !== existingAccount.assignedSalesRepId
    let nextAssignedRep:
      | {
          id: string
          userId: string
          name: string
        }
      | null = null

    if (assignedSalesRepId) {
      const [rep] = await db
        .select({
          id: salesMembers.id,
          userId: salesMembers.userId,
          name: users.name,
        })
        .from(salesMembers)
        .innerJoin(users, eq(salesMembers.userId, users.id))
        .where(eq(salesMembers.id, assignedSalesRepId))
        .limit(1)

      if (!rep) {
        return { error: 'Selected sales lead was not found.' }
      }

      nextAssignedRep = rep
    }

    const changedFields = [
      ['companyName', existingAccount.companyName, companyName],
      ['contactName', existingAccount.contactName, contactName],
      ['phone', existingAccount.phone, phone],
      ['email', existingAccount.email, email],
      ['address', existingAccount.address, address],
      ['city', existingAccount.city, city],
      ['state', existingAccount.state, normalizedGeography.state],
      ['county', existingAccount.county, normalizedGeography.county],
      ['zip', existingAccount.zip, zip],
      ['businessEmail', existingAccount.businessEmail, businessEmail],
      ['businessPhone', existingAccount.businessPhone, businessPhone],
      ['pocName', existingAccount.pocName, pocName],
      ['pocPhone', existingAccount.pocPhone, pocPhone],
      ['pocEmail', existingAccount.pocEmail, pocEmail],
      ['hoursOfOperation', existingAccount.hoursOfOperation, hoursOfOperation],
      ['website', existingAccount.website, website],
      ['dcAbraNumber', existingAccount.dcAbraNumber, dcAbraNumber],
      ['businessType', existingAccount.businessType, businessType],
      ['creditLimit', existingAccount.creditLimit, creditLimit],
      ['paymentTerms', existingAccount.paymentTerms, paymentTerms],
      ['salesLead', existingAccount.assignedSalesRepId, assignedSalesRepId],
      ['liquorLicenseNumber', existingAccount.liquorLicenseNumber, liquorLicenseNumber],
      ['liquorLicenseState', existingAccount.liquorLicenseState, liquorLicenseState],
      ['liquorLicenseExpiration', existingAccount.liquorLicenseExpiration, liquorLicenseExpiration],
      ['liquorLicenseUrl', existingAccount.liquorLicenseUrl, liquorLicenseUrl],
    ].filter(([, previousValue, nextValue]) => (previousValue ?? null) !== (nextValue ?? null)).map(([field]) => field as string)

    const [account] = await db.update(customerAccounts).set({
      companyName,
      contactName,
      address,
      city,
      state: normalizedGeography.state,
      county: normalizedGeography.county,
      zip,
      phone,
      email,
      businessEmail,
      businessPhone,
      pocName,
      pocPhone,
      pocEmail,
      hoursOfOperation,
      website,
      dcAbraNumber,
      businessType,
      creditLimit,
      paymentTerms,
      assignedSalesRepId,
      liquorLicenseNumber,
      liquorLicenseState,
      liquorLicenseExpiration,
      liquorLicenseUrl,
    }).where(eq(customerAccounts.id, id)).returning()

    await logActivityEvent({
      entityType: 'account',
      entityId: id,
      actorUserId: session.user.id,
      kind: 'account_updated',
      title: 'Account details updated',
      body: changedFields.length
        ? `${companyName} account information was edited. Changed: ${changedFields.join(', ')}.`
        : `${companyName} account information was edited.`,
      metadata: {
        changedFields,
        assignedSalesRepId,
      },
    })

    if (hubspotCompanyId) {
      await updateHubSpotCompany(hubspotCompanyId, {
        name: companyName,
        phone: businessPhone || phone || '',
        address: address ?? '',
        city: city ?? '',
        state: normalizedGeography.state ?? '',
        zip: zip ?? '',
        website: website ?? '',
      }).catch(() => false)
    }

    if (account) {
      const hubspotContactId = await upsertHubSpotContact({
        email: pocEmail || businessEmail || email || '',
        firstname: (pocName || account.contactName || account.companyName).split(' ')[0] ?? account.companyName,
        lastname: (pocName || account.contactName || '').split(' ').slice(1).join(' '),
        company: account.companyName,
        phone: pocPhone || businessPhone || phone || '',
        city: account.city ?? '',
        state: account.state ?? '',
        credit_limit: account.creditLimit ?? '0',
    payment_terms: account.paymentTerms ?? 'PREPAID',
        account_balance: account.balance ?? '0',
      }).catch(() => null)

      if (hubspotContactId) {
        await db.update(customerAccounts).set({ hubspotContactId }).where(eq(customerAccounts.id, id))
      }
    }

    if (assignmentChanged && nextAssignedRep?.userId) {
      await createUserNotification({
        userId: nextAssignedRep.userId,
        kind: 'crm_account_assigned',
        title: 'CRM account assigned',
        body: `${companyName} has been assigned to you as the sales lead.`,
        href: `/sales/accounts/${id}`,
      })
    }

    revalidatePath('/admin/crm')
    revalidatePath(`/admin/crm/${id}`)
    revalidatePath(`/admin/crm/${id}/contacts`)
    revalidatePath('/staff/crm')
    revalidatePath(`/staff/crm/${id}`)
    revalidatePath(`/staff/crm/${id}/contacts`)
    revalidatePath('/sales/accounts')
    revalidatePath(`/sales/accounts/${id}`)
    return { success: true, changedFields }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update account.' }
  }
}

export async function createCustomerAccount(
  _prev: { success?: boolean; accountId?: string; error?: string } | null,
  formData: FormData
): Promise<{ success?: boolean; accountId?: string; error?: string }> {
  try {
    const session = await requireAdminOrStaff()

    const companyName = (formData.get('companyName') as string | null)?.trim()
    const phone = ((formData.get('phone') as string) || '').trim() || null
    const email = ((formData.get('email') as string) || '').trim() || null
    const address = ((formData.get('address') as string) || '').trim() || null
    const city = ((formData.get('city') as string) || '').trim() || null
    const state = ((formData.get('state') as string) || '').trim() || null
    const county = ((formData.get('county') as string) || '').trim() || null
    const zip = ((formData.get('zip') as string) || '').trim() || null
    const businessEmail = ((formData.get('businessEmail') as string) || '').trim() || null
    const businessPhone = ((formData.get('businessPhone') as string) || '').trim() || null
    const pocName = ((formData.get('pocName') as string) || '').trim() || null
    const pocPhone = ((formData.get('pocPhone') as string) || '').trim() || null
    const pocEmail = ((formData.get('pocEmail') as string) || '').trim() || null
    const contactName = ((formData.get('contactName') as string) || '').trim() || null
    const hoursOfOperation = ((formData.get('hoursOfOperation') as string) || '').trim() || null
    const website = validateWebsiteUrl(((formData.get('website') as string) || '').trim() || null)
    const dcAbraNumber = ((formData.get('dcAbraNumber') as string) || '').trim() || null
    const creditLimit = ((formData.get('creditLimit') as string) || '0').trim() || '0'
    const paymentTerms = ((formData.get('paymentTerms') as string) || 'PREPAID').trim() || 'PREPAID'
    const normalizedGeography = normalizeAccountGeography({ state, county })

    if (!companyName) {
      return { error: 'Company name is required.' }
    }

    const [account] = await db.insert(customerAccounts).values({
      companyName,
      contactName,
      address,
      city,
      state: normalizedGeography.state,
      county: normalizedGeography.county,
      zip,
      phone,
      email,
      businessEmail,
      businessPhone,
      pocName,
      pocPhone,
      pocEmail,
      hoursOfOperation,
      website,
      dcAbraNumber,
      creditLimit,
      paymentTerms,
    }).returning({ id: customerAccounts.id })

    await logActivityEvent({
      entityType: 'account',
      entityId: account.id,
      actorUserId: session.user.id,
      kind: 'account_created',
      title: 'Account created',
      body: `${companyName} was added to the CRM.`,
    })

    const hubspotContactId = await upsertHubSpotContact({
      email: pocEmail || businessEmail || email || '',
      firstname: (pocName || contactName || companyName).split(' ')[0] ?? companyName,
      lastname: (pocName || contactName || '').split(' ').slice(1).join(' '),
      company: companyName,
      phone: pocPhone || businessPhone || phone || '',
      city: city ?? '',
      state: normalizedGeography.state ?? '',
      credit_limit: creditLimit,
      payment_terms: paymentTerms,
      account_balance: '0',
    }).catch(() => null)

    if (hubspotContactId) {
      await db.update(customerAccounts).set({ hubspotContactId }).where(eq(customerAccounts.id, account.id))
    }

    revalidatePath('/admin/crm')
    revalidatePath('/staff/crm')

    return { success: true, accountId: account.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create account.' }
  }
}

export async function updateAccountBySalesRep(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const id = formData.get('id') as string

  // Verify the rep is assigned to this account (managers/admins can edit any)
  const isRepOnly = (session.user.roles as string[])?.includes('sales_rep') &&
    !(session.user.roles as string[])?.includes('sales_manager') &&
    !(session.user.roles as string[])?.includes('admin')

  if (isRepOnly) {
    const [member] = await db.select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member) return { error: 'No sales member profile found.' }

    const [account] = await db
      .select({ assignedSalesRepId: customerAccounts.assignedSalesRepId })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, id))
      .limit(1)

    if (!account || account.assignedSalesRepId !== member.id) {
      return { error: 'You are not assigned to this account.' }
    }
  }

  await db.update(customerAccounts).set({
    companyName: formData.get('companyName') as string,
    contactName: (formData.get('contactName') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    address: (formData.get('address') as string) || null,
    city: (formData.get('city') as string) || null,
    state: (formData.get('state') as string) || null,
    zip: (formData.get('zip') as string) || null,
    pocName: (formData.get('pocName') as string) || null,
    pocPhone: (formData.get('pocPhone') as string) || null,
    pocEmail: (formData.get('pocEmail') as string) || null,
    hoursOfOperation: (formData.get('hoursOfOperation') as string) || null,
    preferredDeliveryDays: (formData.get('preferredDeliveryDays') as string) || null,
    preferredDeliveryTimes: (formData.get('preferredDeliveryTimes') as string) || null,
    businessType: (formData.get('businessType') as string) || null,
    dcAbraNumber: (formData.get('dcAbraNumber') as string) || null,
    liquorLicenseNumber: (formData.get('liquorLicenseNumber') as string) || null,
    liquorLicenseState: (formData.get('liquorLicenseState') as string) || null,
    liquorLicenseExpiration: (formData.get('liquorLicenseExpiration') as string) || null,
  }).where(eq(customerAccounts.id, id))

  revalidatePath(`/sales/accounts/${id}`)
  revalidatePath('/sales/accounts')
  return { success: true }
}

export async function geocodeAccount(
  accountId: string
): Promise<{ success: boolean; lat?: number; lng?: number; error?: string }> {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  if (await isGeocodeActionRateLimited(session.user.id)) {
    return { success: false, error: 'Geocode limit reached. Please wait before trying again.' }
  }

  const [account] = await db
    .select({
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) return { success: false, error: 'Account not found' }

  const parts = [account.address, account.city, account.state, account.zip].filter(Boolean)
  if (parts.length === 0) return { success: false, error: 'No address on file' }

  const coords = await geocodeAddress(parts.join(', '))
  if (!coords) return { success: false, error: 'Could not geocode this address' }

  await db
    .update(customerAccounts)
    .set({ lat: coords.lat, lng: coords.lng })
    .where(eq(customerAccounts.id, accountId))

  revalidatePath('/sales/routes')
  revalidatePath('/admin/crm')

  return { success: true, lat: coords.lat, lng: coords.lng }
}
