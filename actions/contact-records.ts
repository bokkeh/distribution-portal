'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { contacts, customerAccounts } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { normalizeVenueIdentity } from '@/lib/tastings/scheduling'

export async function updateContactRelationship(contactId: string, data: FormData) {
  await requireRole('admin', 'staff')
  try {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) return { error: 'Contact not found.' }
    const status = String(data.get('relationshipStatus') ?? '')
    if (!['', 'active', 'keep_in_touch', 'inactive'].includes(status)) return { error: 'Choose a valid relationship status.' }
    let customerId = String(data.get('customerId') ?? '') || null
    const newCompanyName = String(data.get('newCompanyName') ?? '').trim()
    if (newCompanyName && customerId) return { error: 'Choose an existing company or enter a new company name.' }
    if (newCompanyName) {
      const accounts = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts)
      if (accounts.some(account => normalizeVenueIdentity(account.companyName) === normalizeVenueIdentity(newCompanyName))) return { error: 'A company with this name exists. Select the existing company.' }
      const key = `${normalizeVenueIdentity(newCompanyName)}||||`
      const [company] = await db.insert(customerAccounts).values({ companyName: newCompanyName, schedulingVenueKey: key, customerSource: 'manual', dealStage: null })
        .onConflictDoUpdate({ target: customerAccounts.schedulingVenueKey, set: { schedulingVenueKey: key } }).returning({ id: customerAccounts.id })
      customerId = company.id
    }
    if (customerId) {
      const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.id, customerId)).limit(1)
      if (!account) return { error: 'Company not found.' }
    }
    await db.update(contacts).set({ customerId, relationshipStatus: status as 'active' | 'keep_in_touch' | 'inactive' || null, isPrimary: customerId ? contact.isPrimary : false }).where(eq(contacts.id, contactId))
    for (const prefix of ['/admin/crm', '/staff/crm']) {
      revalidatePath(prefix); revalidatePath(`${prefix}/people/${contactId}`)
      if (customerId) revalidatePath(`${prefix}/${customerId}`)
      if (contact.customerId) revalidatePath(`${prefix}/${contact.customerId}`)
    }
    return { success: true as const }
  } catch { return { error: 'Could not update this contact. Your entries are kept; retry.' } }
}
