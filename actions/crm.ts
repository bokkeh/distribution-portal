'use server'

import { db } from '@/db'
import { customerAccounts, contacts } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
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
