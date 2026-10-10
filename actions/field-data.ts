'use server'

import { and, asc, eq, gte, inArray, ilike, or } from 'drizzle-orm'
import { db } from '@/db'
import { accountMedia, accountNotes, customerAccounts, products, tasterAvailability, tastings, users } from '@/db/schema'
import { fieldAccount, fieldContext } from '@/lib/field/access'
import { getEasternDateKey } from '@/lib/tastings/time'
import { upcomingTastingFilter } from '@/lib/tastings/upcoming-filter'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'
import { z } from 'zod'

export async function searchFieldAccounts(query: string) {
  const { managesAll, member } = await fieldContext()
  const text = query.trim().slice(0, 100)
  const matches = text ? or(ilike(customerAccounts.companyName, `%${text}%`), ilike(customerAccounts.city, `%${text}%`), ilike(customerAccounts.address, `%${text}%`)) : undefined
  return db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName, address: customerAccounts.address, city: customerAccounts.city, state: customerAccounts.state }).from(customerAccounts)
    .where(and(matches, managesAll ? undefined : eq(customerAccounts.assignedSalesRepId, member!.id))).orderBy(asc(customerAccounts.companyName)).limit(30)
}

export async function getFieldAccount(accountId: string) {
  const { account } = await fieldAccount(accountId)
  return { id: account.id, companyName: account.companyName, address: account.address, city: account.city, state: account.state, zip: account.zip, additionalLocations: account.additionalLocations, email: account.pocEmail || account.businessEmail || account.email || '' }
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
  const team = await db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(eq(users.active, true))
  const tasters = team.filter(user => user.roles.includes('taster'))
  const ids = tasters.map(user => user.id)
  if (!ids.length) return { tasters: [], dates: [], bookings: [] }
  const today = getEasternDateKey(new Date())
  const [dates, bookings] = await Promise.all([
    db.select({ userId: tasterAvailability.userId, date: tasterAvailability.availableDate }).from(tasterAvailability).where(and(inArray(tasterAvailability.userId, ids), gte(tasterAvailability.availableDate, today))).orderBy(asc(tasterAvailability.availableDate)),
    db.select({ userId: tastings.assignedUserId, start: tastings.scheduledAt, end: tastings.endAt, timeZone: tastings.timeZone }).from(tastings).where(and(inArray(tastings.assignedUserId, ids), upcomingTastingFilter())).orderBy(asc(tastings.scheduledAt)),
  ])
  return { tasters: tasters.map(user => ({ id: user.id, name: user.name })), dates, bookings: bookings.map(row => ({ ...row, start: row.start.toISOString(), end: row.end?.toISOString() ?? null })) }
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
  const parsed = z.object({ requestId: z.uuid(), accountId: z.uuid(), mediaUrl: z.url().startsWith('https://'), caption: z.string().max(2000), date: z.iso.date() }).safeParse(input)
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
