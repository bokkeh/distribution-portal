'use server'

import { db } from '@/db'
import { customerAccounts, contacts } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { upsertHubSpotContact, getHubSpotCompanies, updateHubSpotCompany } from '@/lib/hubspot/client'

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
}

export async function addContact(formData: FormData) {
  await requireAdminOrStaff()

  const customerId = formData.get('customerId') as string
  const name = formData.get('name') as string
  const email = formData.get('email') as string | null
  const phone = formData.get('phone') as string | null
  const title = formData.get('title') as string | null
  const isPrimary = formData.get('isPrimary') === 'on'

  await db.insert(contacts).values({
    customerId, name,
    email: email || null,
    phone: phone || null,
    title: title || null,
    isPrimary,
  })

  revalidatePath(`/admin/crm/${customerId}`)
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
    address: company.address,
    city: company.city,
    state: company.state,
    zip: company.zip,
    phone: company.phone,
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

export async function updateCustomerAccount(formData: FormData) {
  await requireAdminOrStaff()

  const id = formData.get('id') as string
  await db.update(customerAccounts).set({
    companyName: formData.get('companyName') as string,
    address: formData.get('address') as string || null,
    city: formData.get('city') as string || null,
    state: formData.get('state') as string || null,
    zip: formData.get('zip') as string || null,
    phone: formData.get('phone') as string || null,
    creditLimit: formData.get('creditLimit') as string,
    paymentTerms: formData.get('paymentTerms') as string,
  }).where(eq(customerAccounts.id, id))

  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${id}`)
}
