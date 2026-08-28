import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/db'
import { contacts, customerAccounts, deliveries, deliveryStops, drivers, orders, products, salesMembers, tastings, users } from '@/db/schema'
import { getEffectiveSession } from '@/lib/auth/session'

const ALLOWED_ROLES = ['admin', 'staff', 'sales_rep', 'sales_manager']

export async function GET(request: NextRequest) {
  const session = await getEffectiveSession()
  const roles = session?.user.roles ?? (session?.user.role ? [session.user.role as string] : [])
  if (!session || !roles.some((role) => ALLOWED_ROLES.includes(role))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const isRepOnly = roles.includes('sales_rep') && !roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  const [repMember] = isRepOnly
    ? await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
    : []
  const accountAccess = isRepOnly
    ? (repMember ? eq(customerAccounts.assignedSalesRepId, repMember.id) : eq(customerAccounts.id, '00000000-0000-0000-0000-000000000000'))
    : undefined

  const scope = request.nextUrl.searchParams.get('scope') ?? 'accounts'
  const accountId = request.nextUrl.searchParams.get('accountId')?.trim() || null

  if (scope === 'bootstrap') {
    const [userRows, productRows, driverRows, salesMemberRows] = await Promise.all([
      db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
      db.select({ id: products.id, name: products.name, sku: products.sku, price: products.price, bottlePrice: products.bottlePrice, bottlesPerCase: products.bottlesPerCase })
        .from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
      db.select({ id: drivers.id, userId: users.id, name: users.name }).from(drivers).innerJoin(users, eq(users.id, drivers.userId))
        .where(and(eq(drivers.active, true), eq(users.active, true))).orderBy(asc(users.name)),
      db.select({ id: salesMembers.id, userId: users.id, name: users.name }).from(salesMembers).innerJoin(users, eq(users.id, salesMembers.userId))
        .where(and(eq(salesMembers.status, 'active'), eq(users.active, true))).orderBy(asc(users.name)),
    ])
    return NextResponse.json({
      currentUser: { id: session.user.id, name: session.user.name ?? 'You', roles },
      users: userRows
        .filter((user) => user.roles.some((role) => [...ALLOWED_ROLES, 'taster'].includes(role)))
        .sort((left, right) => left.id === session.user.id ? -1 : right.id === session.user.id ? 1 : left.name.localeCompare(right.name)),
      products: productRows,
      drivers: driverRows,
      salesMembers: salesMemberRows,
    })
  }

  if (scope === 'related') {
    if (!accountId) return NextResponse.json({ contacts: [], orders: [], tastings: [], deliveries: [] })
    if (accountAccess) {
      const [allowedAccount] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(and(eq(customerAccounts.id, accountId), accountAccess)).limit(1)
      if (!allowedAccount) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [contactRows, orderRows, tastingRows, deliveryRows] = await Promise.all([
      db.select({ id: contacts.id, name: contacts.name, title: contacts.title, email: contacts.email }).from(contacts)
        .where(eq(contacts.customerId, accountId)).orderBy(asc(contacts.name)),
      db.select({ id: orders.id, createdAt: orders.createdAt, total: orders.total, status: orders.status, isAssisted: orders.isAssisted }).from(orders)
        .where(eq(orders.customerId, accountId)).orderBy(desc(orders.createdAt)).limit(50),
      db.select({ id: tastings.id, eventName: tastings.eventName, scheduledAt: tastings.scheduledAt, status: tastings.status }).from(tastings)
        .where(eq(tastings.customerId, accountId)).orderBy(desc(tastings.scheduledAt)).limit(50),
      db.select({ id: deliveries.id, weekStartDate: deliveries.weekStartDate, status: deliveries.status, stopStatus: deliveryStops.status })
        .from(deliveryStops).innerJoin(deliveries, eq(deliveries.id, deliveryStops.deliveryId))
        .where(eq(deliveryStops.customerId, accountId)).orderBy(desc(deliveries.createdAt)).limit(50),
    ])
    return NextResponse.json({ contacts: contactRows, orders: orderRows, tastings: tastingRows, deliveries: deliveryRows })
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() || ''
  const id = request.nextUrl.searchParams.get('id')?.trim() || null
  const searchWhere = id
    ? eq(customerAccounts.id, id)
    : query
      ? or(
          ilike(customerAccounts.companyName, `%${query}%`),
          ilike(customerAccounts.contactName, `%${query}%`),
          ilike(customerAccounts.pocName, `%${query}%`),
          ilike(customerAccounts.city, `%${query}%`),
          ilike(customerAccounts.address, `%${query}%`),
        )
      : undefined
  const where = accountAccess && searchWhere ? and(accountAccess, searchWhere) : accountAccess ?? searchWhere
  const rows = await db.select({
    id: customerAccounts.id,
    companyName: customerAccounts.companyName,
    address: customerAccounts.address,
    city: customerAccounts.city,
    state: customerAccounts.state,
    contactName: customerAccounts.contactName,
  }).from(customerAccounts).where(where).orderBy(asc(customerAccounts.companyName)).limit(id ? 1 : 25)

  return NextResponse.json({ accounts: rows })
}
