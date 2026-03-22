'use server'

import { db } from '@/db'
import { accountPreferences, activityEvents, contacts, customerAccounts, deliveryStops, invoices, orders, salesMembers, salesRouteStops, smsThreads, tastings } from '@/db/schema'
import { requireAdminOrStaff, requireRole } from '@/lib/auth/session'
import { geocodeAddress } from '@/lib/maps/geocode'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { upsertHubSpotContact, getHubSpotCompanies, updateHubSpotCompany } from '@/lib/hubspot/client'
import { logActivityEvent } from '@/lib/activity/log'

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

  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId))
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
    payment_terms: account.paymentTerms ?? 'NET30',
    account_balance: account.balance ?? '0',
  })

  if (hubspotId) {
    await db.update(customerAccounts)
      .set({ hubspotContactId: hubspotId })
      .where(eq(customerAccounts.id, accountId))
  }

  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
}

function revalidateContactPaths(customerId: string) {
  revalidatePath(`/admin/crm/${customerId}`)
  revalidatePath(`/admin/crm/${customerId}/contacts`)
  revalidatePath(`/staff/crm/${customerId}`)
  revalidatePath(`/staff/crm/${customerId}/contacts`)
}

export async function addContact(formData: FormData) {
  await requireAdminOrStaff()

  const customerId = formData.get('customerId') as string
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

  revalidateContactPaths(customerId)
}

export async function updateContact(contactId: string, formData: FormData) {
  await requireAdminOrStaff()

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const phoneType = (formData.get('phoneType') as string) || null
  const preferredContact = (formData.get('preferredContact') as string) || null
  const title = (formData.get('title') as string)?.trim() || null
  const isPrimary = formData.get('isPrimary') === 'on'

  const [contact] = await db.select({ customerId: contacts.customerId }).from(contacts).where(eq(contacts.id, contactId))
  if (!contact) return { error: 'Contact not found' }

  await db.update(contacts).set({
    name,
    email,
    phone,
    phoneType: phoneType as 'mobile' | 'landline' | 'voip' | 'other' | null,
    preferredContact: preferredContact as 'email' | 'sms' | 'call' | null,
    title,
    isPrimary,
  }).where(eq(contacts.id, contactId))

  revalidateContactPaths(contact.customerId)
  return { success: true }
}

export async function deleteContact(contactId: string) {
  await requireAdminOrStaff()

  const [contact] = await db.select({ customerId: contacts.customerId }).from(contacts).where(eq(contacts.id, contactId))
  if (!contact) return { error: 'Contact not found' }

  await db.delete(contacts).where(eq(contacts.id, contactId))
  revalidateContactPaths(contact.customerId)
  return { success: true }
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

  await db.insert(customerAccounts).values({
    companyName: company.name,
    contactName: null,
    address: company.address,
    city: company.city,
    state: company.state,
    zip: company.zip,
    phone: company.phone,
    dcAbraNumber: null,
    hubspotCompanyId: company.id,
    creditLimit: '0',
    balance: '0',
    paymentTerms: 'NET30',
  })

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
) {
  await requireAdminOrStaff()

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
    const session = await requireAdminOrStaff()

    const id = formData.get('id') as string
    const mode = (formData.get('mode') as string) || 'admin'
    const hubspotCompanyId = (formData.get('hubspotCompanyId') as string) || null
    const companyName = formData.get('companyName') as string
    const phone = (formData.get('phone') as string) || null
    const email = (formData.get('email') as string) || null
    const address = (formData.get('address') as string) || null
    const city = (formData.get('city') as string) || null
    const state = (formData.get('state') as string) || null
    const zip = (formData.get('zip') as string) || null
    const businessEmail = (formData.get('businessEmail') as string) || null
    const businessPhone = (formData.get('businessPhone') as string) || null
    const pocName = (formData.get('pocName') as string) || null
    const pocPhone = (formData.get('pocPhone') as string) || null
    const pocEmail = (formData.get('pocEmail') as string) || null
    const contactName = (formData.get('contactName') as string) || null
    const hoursOfOperation = (formData.get('hoursOfOperation') as string) || null
    const dcAbraNumber = (formData.get('dcAbraNumber') as string) || null
    const businessType = (formData.get('businessType') as string) || null
    const creditLimit = formData.get('creditLimit') as string
    const paymentTerms = formData.get('paymentTerms') as string

    const [existingAccount] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, id)).limit(1)
    if (!existingAccount) {
      return { error: 'Account not found.' }
    }

    const changedFields = [
      ['companyName', existingAccount.companyName, companyName],
      ['contactName', existingAccount.contactName, contactName],
      ['phone', existingAccount.phone, phone],
      ['email', existingAccount.email, email],
      ['address', existingAccount.address, address],
      ['city', existingAccount.city, city],
      ['state', existingAccount.state, state],
      ['zip', existingAccount.zip, zip],
      ['businessEmail', existingAccount.businessEmail, businessEmail],
      ['businessPhone', existingAccount.businessPhone, businessPhone],
      ['pocName', existingAccount.pocName, pocName],
      ['pocPhone', existingAccount.pocPhone, pocPhone],
      ['pocEmail', existingAccount.pocEmail, pocEmail],
      ['hoursOfOperation', existingAccount.hoursOfOperation, hoursOfOperation],
      ['dcAbraNumber', existingAccount.dcAbraNumber, dcAbraNumber],
      ['businessType', existingAccount.businessType, businessType],
      ['creditLimit', existingAccount.creditLimit, creditLimit],
      ['paymentTerms', existingAccount.paymentTerms, paymentTerms],
    ].filter(([, previousValue, nextValue]) => (previousValue ?? null) !== (nextValue ?? null)).map(([field]) => field as string)

    await db.update(customerAccounts).set({
      companyName,
      contactName,
      address,
      city,
      state,
      zip,
      phone,
      email,
      businessEmail,
      businessPhone,
      pocName,
      pocPhone,
      pocEmail,
      hoursOfOperation,
      dcAbraNumber,
      businessType,
      creditLimit,
      paymentTerms,
    }).where(eq(customerAccounts.id, id))

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
      },
    })

    if (hubspotCompanyId) {
      await updateHubSpotCompany(hubspotCompanyId, {
        name: companyName,
        phone: businessPhone || phone || '',
        address: address ?? '',
        city: city ?? '',
        state: state ?? '',
        zip: zip ?? '',
      }).catch(() => false)
    }

    const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, id)).limit(1)
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
        payment_terms: account.paymentTerms ?? 'NET30',
        account_balance: account.balance ?? '0',
      }).catch(() => null)

      if (hubspotContactId) {
        await db.update(customerAccounts).set({ hubspotContactId }).where(eq(customerAccounts.id, id))
      }
    }

    revalidatePath('/admin/crm')
    revalidatePath(`/admin/crm/${id}`)
    revalidatePath(`/admin/crm/${id}/contacts`)
    revalidatePath('/staff/crm')
    revalidatePath(`/staff/crm/${id}`)
    revalidatePath(`/staff/crm/${id}/contacts`)
    revalidatePath(`/${mode}/crm/${id}`)
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
    const zip = ((formData.get('zip') as string) || '').trim() || null
    const businessEmail = ((formData.get('businessEmail') as string) || '').trim() || null
    const businessPhone = ((formData.get('businessPhone') as string) || '').trim() || null
    const pocName = ((formData.get('pocName') as string) || '').trim() || null
    const pocPhone = ((formData.get('pocPhone') as string) || '').trim() || null
    const pocEmail = ((formData.get('pocEmail') as string) || '').trim() || null
    const contactName = ((formData.get('contactName') as string) || '').trim() || null
    const hoursOfOperation = ((formData.get('hoursOfOperation') as string) || '').trim() || null
    const dcAbraNumber = ((formData.get('dcAbraNumber') as string) || '').trim() || null
    const creditLimit = ((formData.get('creditLimit') as string) || '0').trim() || '0'
    const paymentTerms = ((formData.get('paymentTerms') as string) || 'NET30').trim() || 'NET30'

    if (!companyName) {
      return { error: 'Company name is required.' }
    }

    const [account] = await db.insert(customerAccounts).values({
      companyName,
      contactName,
      address,
      city,
      state,
      zip,
      phone,
      email,
      businessEmail,
      businessPhone,
      pocName,
      pocPhone,
      pocEmail,
      hoursOfOperation,
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
      state: state ?? '',
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
  await requireRole('sales_rep', 'sales_manager', 'admin')

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
