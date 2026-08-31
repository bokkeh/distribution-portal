import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/db'
import { events, invoices, tastings, users } from '@/db/schema'
import { ilike, or, desc } from 'drizzle-orm'
import { searchAccounts } from '@/lib/search/account-search'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : [])
  if (!roles.some((role) => role === 'admin' || role === 'staff')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const like = `%${q}%`
  const isAdmin = roles.includes('admin')
  const accountBasePath = isAdmin ? '/admin/crm' : '/staff/crm'
  const results: Array<{
    id: string
    label: string
    sublabel?: string
    href: string
    type: 'order' | 'account' | 'invoice' | 'tasting' | 'event' | 'delivery' | 'user'
  }> = []

  await Promise.all([
    // Accounts
    searchAccounts(q, 8)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'account',
        label: r.companyName,
        sublabel: [r.city, r.state].filter(Boolean).join(', ') || undefined,
        href: `${accountBasePath}/${r.id}`,
      }))),

    // Invoices
    db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, total: invoices.total, status: invoices.status })
      .from(invoices)
      .where(ilike(invoices.invoiceNumber, like))
      .limit(5)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'invoice',
        label: `Invoice ${r.invoiceNumber}`,
        sublabel: `${r.status} · $${Number(r.total).toFixed(2)}`,
        href: `/admin/invoicing/${r.id}`,
      }))),

    // Tastings
    db.select({ id: tastings.id, eventName: tastings.eventName, storeCity: tastings.storeCity, status: tastings.status })
      .from(tastings)
      .where(or(ilike(tastings.eventName, like), ilike(tastings.storeCity, like)))
      .orderBy(desc(tastings.scheduledAt))
      .limit(5)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'tasting',
        label: r.eventName,
        sublabel: [r.storeCity, r.status].filter(Boolean).join(' · ') || undefined,
        href: `/admin/tastings/${r.id}`,
      }))),

    // Events (kept distinct from tastings)
    db.select({ id: events.id, title: events.title, city: events.city, status: events.status })
      .from(events)
      .where(or(ilike(events.title, like), ilike(events.city, like), ilike(events.venueName, like)))
      .orderBy(desc(events.startAt))
      .limit(5)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'event',
        label: r.title,
        sublabel: [r.city, r.status].filter(Boolean).join(' · ') || undefined,
        href: `/${isAdmin ? 'admin' : 'staff'}/events/${r.id}`,
      }))),

    // Users
    isAdmin ? db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(or(ilike(users.name, like), ilike(users.email, like)))
      .limit(5)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'user',
        label: r.name,
        sublabel: `${r.email} · ${r.role}`,
        href: `/admin/users/${r.id}`,
      }))) : Promise.resolve(),
  ])

  const typeOrder = { account: 0, event: 1, invoice: 2, tasting: 3, user: 4, order: 5, delivery: 6 }
  return NextResponse.json(results
    .sort((left, right) => typeOrder[left.type] - typeOrder[right.type])
    .slice(0, 15))
}
