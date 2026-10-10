'use server'

import { and, asc, desc, eq, gte, inArray, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accountMedia, accountNotes, contacts, customerAccounts, products, tasterAvailability, tastings, users } from '@/db/schema'
import { fieldAccount, fieldContext } from '@/lib/field/access'
import { getEasternDateKey } from '@/lib/tastings/time'
import { upcomingTastingFilter } from '@/lib/tastings/upcoming-filter'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'
import { z } from 'zod'
import { fieldAccountSchema, fieldContactSchema, type FieldAccountInput, type FieldContactInput } from '@/lib/field/validation'
import { normalizeVenueIdentity } from '@/lib/tastings/scheduling'
import { after } from 'next/server'
import { logActivityEvent } from '@/lib/activity/log'

export async function createFieldAccount(raw: FieldAccountInput): Promise<{ success: true; account: Awaited<ReturnType<typeof getFieldAccount>> } | { error: string; matches?: Awaited<ReturnType<typeof searchFieldAccounts>> }> {
  const parsed = fieldAccountSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const input = parsed.data
  try {
    const { session, managesAll, member } = await fieldContext()
    const sourceExternalId = `field:${session.user.id}:${input.requestId}`
    const [retry] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, input.requestId)).limit(1)
    if (retry) {
      if (retry.sourceExternalId !== sourceExternalId || retry.companyName !== input.companyName || (retry.address ?? '') !== input.address || (retry.city ?? '') !== input.city || (retry.state ?? '') !== input.state || (retry.zip ?? '') !== input.zip || (retry.email ?? '') !== input.email || (retry.phone ?? '') !== input.phone) return { error: 'This request already saved different details. Start a new account or select the saved account.' }
      const account = await getFieldAccount(retry.id)
      refreshFieldAccount(account.id)
      return { success: true as const, account }
    }
    const candidates = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName, address: customerAccounts.address, city: customerAccounts.city, state: customerAccounts.state, assignedSalesRepId: customerAccounts.assignedSalesRepId }).from(customerAccounts)
    const matches = candidates.filter(row => normalizeVenueIdentity(row.companyName) === normalizeVenueIdentity(input.companyName))
    if (matches.length) return { error: 'An account with this name already exists. Select it below, or use a distinct location name. If it is not listed, ask your administrator to check your account access.', matches: matches.filter(row => managesAll || row.assignedSalesRepId === member?.id).map(({ id, companyName, address, city, state }) => ({ id, companyName, address, city, state })) }
    const schedulingVenueKey = [input.companyName, input.address, input.city, input.state, input.zip].map(normalizeVenueIdentity).join('|')
    const [created] = await db.insert(customerAccounts).values({ id: input.requestId, companyName: input.companyName, address: input.address || null, city: input.city || null, state: input.state || null, zip: input.zip || null, email: input.email || null, phone: input.phone || null, assignedSalesRepId: member?.id ?? null, schedulingVenueKey, customerSource: 'manual', sourceExternalId, dealStage: null }).onConflictDoNothing().returning({ id: customerAccounts.id })
    if (!created) {
      // A racing/lost-response request may have saved this exact entry. Verify it on retry.
      const [saved] = await db.select({ id: customerAccounts.id, sourceExternalId: customerAccounts.sourceExternalId }).from(customerAccounts).where(eq(customerAccounts.id, input.requestId)).limit(1)
      if (saved?.sourceExternalId === sourceExternalId) return createFieldAccount(raw)
      return { error: 'This account may already have been saved. Search for its name before retrying.', matches: await searchFieldAccounts(input.companyName) }
    }
    const account = await getFieldAccount(created.id)
    refreshFieldAccount(account.id)
    for (const path of ['/admin/crm', '/staff/crm', '/sales/accounts', '/admin/dashboard', '/sales/dashboard']) revalidatePath(path)
    after(async () => { try { await logActivityEvent({ entityType: 'account', entityId: account.id, actorUserId: session.user.id, kind: 'field_account_created', title: 'Account created in the field', body: account.companyName }) } catch (error) { console.error('Field account saved; audit failed:', error) } })
    return { success: true as const, account }
  } catch { return { error: 'Could not confirm account save. Your details are kept. Retry the same entry to avoid duplicates.' } }
}

export async function searchFieldAccounts(query: string) {
  const { managesAll, member } = await fieldContext()
  const text = query.trim().slice(0, 100)
  const matches = text ? or(ilike(customerAccounts.companyName, `%${text}%`), ilike(customerAccounts.city, `%${text}%`), ilike(customerAccounts.address, `%${text}%`)) : undefined
  return db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName, address: customerAccounts.address, city: customerAccounts.city, state: customerAccounts.state }).from(customerAccounts)
    .where(and(matches, managesAll ? undefined : eq(customerAccounts.assignedSalesRepId, member!.id))).orderBy(asc(customerAccounts.companyName)).limit(30)
}

export async function getFieldAccount(accountId: string) {
  const { account } = await fieldAccount(accountId)
  const contactRows = await db.select({ id: contacts.id, name: contacts.name, title: contacts.title, email: contacts.email, phone: contacts.phone, preferredContact: contacts.preferredContact, isPrimary: contacts.isPrimary }).from(contacts).where(eq(contacts.customerId, accountId)).orderBy(desc(contacts.isPrimary), asc(contacts.name), asc(contacts.id))
  return { id: account.id, companyName: account.companyName, address: account.address, city: account.city, state: account.state, zip: account.zip, additionalLocations: account.additionalLocations, email: account.pocEmail || account.businessEmail || account.email || '',
    contacts: contactRows, pointOfContact: { name: account.pocName, phone: account.pocPhone, email: account.pocEmail }, businessContact: { phone: account.businessPhone || account.phone, email: account.businessEmail || account.email } }
}

export async function createFieldContact(raw: FieldContactInput) {
  const parsed = fieldContactSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const input = parsed.data
  try {
    const { session } = await fieldAccount(input.accountId)
    const values = { id: input.requestId, customerId: input.accountId, name: input.name, email: input.email.toLowerCase() || null, phone: input.phone || null, title: input.title || null, preferredContact: input.preferredContact || null, isPrimary: input.isPrimary }
    const matchesRequest = (row: typeof contacts.$inferSelect) => row.customerId === values.customerId && row.name === values.name && row.email === values.email && row.phone === values.phone && row.title === values.title && row.preferredContact === values.preferredContact && row.isPrimary === values.isPrimary
    const [retry] = await db.select().from(contacts).where(eq(contacts.id, input.requestId)).limit(1)
    if (retry && !matchesRequest(retry)) return { error: 'This request already saved different contact details. Check the contact list before starting another entry.' }
    if (!retry) {
      const existing = await db.select().from(contacts).where(eq(contacts.customerId, input.accountId))
      const duplicate = existing.find(row => (values.email && row.email?.trim().toLowerCase() === values.email) || (row.name.trim().toLowerCase() === values.name.toLowerCase() && ((!values.email && !values.phone) || (values.phone && row.phone?.replace(/\D/g, '') === values.phone.replace(/\D/g, '')))))
      if (duplicate) return { error: `${duplicate.name} is already listed for this account. Check the contact card before adding another entry.` }
      const [created] = await db.insert(contacts).values(values).onConflictDoNothing({ target: contacts.id }).returning()
      if (!created) {
        const [saved] = await db.select().from(contacts).where(eq(contacts.id, input.requestId)).limit(1)
        if (!saved || !matchesRequest(saved)) return { error: 'This contact request contains different details. Check the contact list.' }
      } else after(async () => { try { await logActivityEvent({ entityType: 'account', entityId: input.accountId, actorUserId: session.user.id, kind: 'contact_added', title: 'Contact added in the field', body: `${input.name} was added to the account contacts.` }) } catch (error) { console.error('Field contact saved; audit failed:', error) } })
    }
    refreshFieldAccount(input.accountId)
    for (const path of ['/admin/crm', '/staff/crm', '/sales/accounts', `/admin/crm/${input.accountId}/contacts`, `/staff/crm/${input.accountId}/contacts`, `/sales/accounts/${input.accountId}/contacts`]) revalidatePath(path)
    return { success: true as const, account: await getFieldAccount(input.accountId) }
  } catch { return { error: 'Could not confirm contact save. Your details are kept; retry the same entry to avoid duplicates.' } }
}

export async function getFieldAccountTastings(accountId: string) {
  await fieldAccount(accountId)
  const now = new Date()
  const columns = { id: tastings.id, eventName: tastings.eventName, start: tastings.scheduledAt, end: tastings.endAt, timeZone: tastings.timeZone, status: tastings.status, assignee: users.name, address: tastings.storeAddress, city: tastings.storeCity, state: tastings.storeState }
  const [past, upcoming] = await Promise.all([
    db.select(columns).from(tastings).leftJoin(users, eq(tastings.assignedUserId, users.id)).where(and(
      eq(tastings.customerId, accountId), inArray(tastings.status, ['scheduled', 'confirmed', 'completed']),
      sql`COALESCE(${tastings.endAt}, ${tastings.scheduledAt} + interval '2 hours') <= ${now.toISOString()}::timestamptz`,
    )).orderBy(desc(tastings.scheduledAt), desc(tastings.id)).limit(1),
    db.select(columns).from(tastings).leftJoin(users, eq(tastings.assignedUserId, users.id)).where(and(eq(tastings.customerId, accountId), upcomingTastingFilter(now))).orderBy(asc(tastings.scheduledAt), asc(tastings.id)),
  ])
  const serialize = (row: typeof upcoming[number]) => ({ ...row, start: row.start.toISOString(), end: row.end?.toISOString() ?? null, assignee: row.assignee ?? 'Unassigned' })
  return { last: past[0] ? serialize(past[0]) : null, upcoming: upcoming.map(serialize) }
}

export async function getFieldBootstrap() {
  const { session } = await fieldContext()
  const [productRows, team] = await Promise.all([
    db.select({ id: products.id, name: products.name, sku: products.sku, price: products.price, bottlesPerCase: products.bottlesPerCase }).from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ])
  return { userName: session.user.name ?? 'Team member', canInvoice: session.user.roles.some(role => ['admin', 'staff'].includes(role)), canPhotos: session.user.roles.some(role => ['admin', 'sales_rep', 'sales_manager'].includes(role)), products: productRows,
    members: team.filter(member => member.roles.some(role => ['admin', 'staff', 'sales_manager', 'sales_rep', 'taster'].includes(role))) }
}

export async function getFieldAvailability() {
  await fieldContext()
  const team = await db.select({ id: users.id, name: users.name, roles: users.roles, avatarUrl: users.avatarUrl }).from(users).where(eq(users.active, true))
  const tasters = team.filter(user => user.roles.includes('taster'))
  const ids = tasters.map(user => user.id)
  if (!ids.length) return { tasters: [], dates: [], bookings: [] }
  const today = getEasternDateKey(new Date())
  const [dates, bookings] = await Promise.all([
    db.select({ userId: tasterAvailability.userId, date: tasterAvailability.availableDate }).from(tasterAvailability).where(and(inArray(tasterAvailability.userId, ids), gte(tasterAvailability.availableDate, today))).orderBy(asc(tasterAvailability.availableDate)),
    db.select({ userId: tastings.assignedUserId, start: tastings.scheduledAt, end: tastings.endAt, timeZone: tastings.timeZone }).from(tastings).where(and(inArray(tastings.assignedUserId, ids), upcomingTastingFilter())).orderBy(asc(tastings.scheduledAt)),
  ])
  return { tasters: tasters.map(user => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl })), dates, bookings: bookings.map(row => ({ ...row, start: row.start.toISOString(), end: row.end?.toISOString() ?? null })) }
}

function refreshFieldAccount(accountId: string) {
  for (const path of ['/field', `/admin/crm/${accountId}`, `/staff/crm/${accountId}`, `/sales/accounts/${accountId}`]) revalidatePath(path)
}

export async function saveFieldNote(accountId: string, noteBody: string, requestId: string) {
  const parsed = z.object({ accountId: z.uuid(), noteBody: z.string().trim().min(1).max(4000), requestId: z.uuid() }).safeParse({ accountId, noteBody, requestId })
  if (!parsed.success) return { error: 'Select an account and enter a note up to 4,000 characters.' }
  try {
    const { session } = await fieldAccount(accountId)
    await db.insert(accountNotes).values({ id: requestId, accountId, noteBody: parsed.data.noteBody, noteType: 'general_update', authorUserId: session.user.id, authorRole: session.user.role }).onConflictDoNothing({ target: accountNotes.id })
    const [saved] = await db.select().from(accountNotes).where(eq(accountNotes.id, requestId)).limit(1)
    if (!saved || saved.accountId !== accountId || saved.authorUserId !== session.user.id || saved.noteBody !== parsed.data.noteBody) return { error: 'This note request already contains different details. Start a new note.' }
    refreshFieldAccount(accountId)
    return { success: true as const }
  } catch { return { error: 'Could not confirm note save. Your note is kept; retry the same entry.' } }
}

export async function saveFieldPhoto(input: { requestId: string; accountId: string; mediaUrl: string; caption: string; date: string }) {
  const mediaUrl = z.union([z.url().startsWith('https://'), z.string().refine(value => {
    if (!value.startsWith('/api/image?')) return false
    const url = new URL(value, 'https://field.invalid')
    const path = url.searchParams.get('path')
    return !!path && path.startsWith('account-media/') && !path.includes('..') && !url.hash && [...url.searchParams.keys()].every(key => key === 'path')
  })])
  const parsed = z.object({ requestId: z.uuid(), accountId: z.uuid(), mediaUrl, caption: z.string().max(2000), date: z.iso.date() }).safeParse(input)
  if (!parsed.success) return { error: 'Choose a valid uploaded photo, caption and date.' }
  try {
    // Match the existing account-media upload roles, including rep account scope.
    await requireRole('admin', 'sales_rep', 'sales_manager')
    const { session } = await fieldAccount(input.accountId)
    await db.insert(accountMedia).values({ id: input.requestId, accountId: input.accountId, mediaUrl: input.mediaUrl, caption: input.caption || null, mediaType: 'image', category: 'store_visit', taggedDate: new Date(`${input.date}T12:00:00Z`), uploadedByUserId: session.user.id }).onConflictDoNothing({ target: accountMedia.id })
    const [saved] = await db.select().from(accountMedia).where(eq(accountMedia.id, input.requestId)).limit(1)
    if (!saved || saved.accountId !== input.accountId || saved.uploadedByUserId !== session.user.id || saved.mediaUrl !== input.mediaUrl || (saved.caption ?? '') !== input.caption) return { error: 'This photo request was already saved with different details. Choose the next photo.' }
    refreshFieldAccount(input.accountId)
    return { success: true as const }
  } catch { return { error: 'Could not confirm photo save. Your upload is kept; retry saving the same photo.' } }
}
