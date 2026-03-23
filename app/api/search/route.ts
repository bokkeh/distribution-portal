import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/db'
import { orders, customerAccounts, invoices, tastings, deliveries, users } from '@/db/schema'
import { ilike, or, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const like = `%${q}%`
  const results: Array<{
    id: string
    label: string
    sublabel?: string
    href: string
    type: 'order' | 'account' | 'invoice' | 'tasting' | 'delivery' | 'user'
  }> = []

  await Promise.all([
    // Accounts
    db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName, city: customerAccounts.city, state: customerAccounts.state })
      .from(customerAccounts)
      .where(or(ilike(customerAccounts.companyName, like), ilike(customerAccounts.email, like)))
      .limit(5)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'account',
        label: r.companyName,
        sublabel: [r.city, r.state].filter(Boolean).join(', ') || undefined,
        href: `/admin/crm/${r.id}`,
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

    // Users
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(or(ilike(users.name, like), ilike(users.email, like)))
      .limit(5)
      .then(rows => rows.forEach(r => results.push({
        id: r.id, type: 'user',
        label: r.name,
        sublabel: `${r.email} · ${r.role}`,
        href: `/admin/users/${r.id}`,
      }))),
  ])

  return NextResponse.json(results.slice(0, 15))
}
