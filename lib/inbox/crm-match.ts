import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { contacts, customerAccounts, users } from '@/db/schema'
import { normalizePhone } from '@/lib/telnyx/compliance'

type ContactMatch = {
  name: string
  avatarUrl: string | null
}

function safeNormalizePhone(value: string | null | undefined) {
  if (!value) return null
  try {
    return normalizePhone(value)
  } catch {
    return null
  }
}

export async function getInboxContactMatches(phones: string[]) {
  const targetPhones = new Set(phones)
  const results = new Map<string, ContactMatch>()

  const [crmContacts, accounts, userRows] = await Promise.all([
    db.select({
      name: contacts.name,
      phone: contacts.phone,
    }).from(contacts),
    db.select({
      companyName: customerAccounts.companyName,
      contactName: customerAccounts.contactName,
      phone: customerAccounts.phone,
      pocName: customerAccounts.pocName,
      pocPhone: customerAccounts.pocPhone,
      businessPhone: customerAccounts.businessPhone,
      avatarUrl: users.avatarUrl,
    }).from(customerAccounts).leftJoin(users, eq(customerAccounts.userId, users.id)),
    db.select({
      name: users.name,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    }).from(users),
  ])

  for (const contact of crmContacts) {
    const normalized = safeNormalizePhone(contact.phone)
    if (!normalized || !targetPhones.has(normalized) || results.has(normalized)) continue
    results.set(normalized, {
      name: contact.name,
      avatarUrl: null,
    })
  }

  for (const account of accounts) {
    for (const candidate of [
      { phone: account.pocPhone, name: account.pocName || account.contactName || account.companyName },
      { phone: account.businessPhone, name: account.contactName || account.companyName },
      { phone: account.phone, name: account.contactName || account.companyName },
    ]) {
      const normalized = safeNormalizePhone(candidate.phone)
      if (!normalized || !targetPhones.has(normalized) || results.has(normalized)) continue
      results.set(normalized, {
        name: candidate.name || account.companyName,
        avatarUrl: account.avatarUrl ?? null,
      })
    }
  }

  for (const user of userRows) {
    const normalized = safeNormalizePhone(user.phone)
    if (!normalized || !targetPhones.has(normalized) || results.has(normalized)) continue
    results.set(normalized, {
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
    })
  }

  return results
}
