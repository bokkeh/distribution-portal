import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { orders, invoices, deliveries, deliveryStops, tastings, tastingReports, wholesaleAccountRequests, users } from '@/db/schema'
import { and, eq, gte, isNotNull, ne, sql } from 'drizzle-orm'
import { sendSms } from '@/lib/telnyx/client'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function fmt(n: number | string, prefix = '') {
  const num = Number(n)
  if (num === 0) return null
  return `${prefix}${num}`
}

function fmtCurrency(n: number | string) {
  const num = Number(n)
  if (num === 0) return null
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date()
  since.setHours(since.getHours() - 24)

  // Fetch all metrics in parallel
  const [
    newOrders,
    paidInvoices,
    completedDeliveries,
    completedTastings,
    newWholesaleRequests,
    adminUsers,
  ] = await Promise.all([
    // New orders in last 24h
    db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(total::numeric), 0)`,
      })
      .from(orders)
      .where(and(ne(orders.status, 'cancelled'), gte(orders.createdAt, since)))
      .then(r => ({ count: Number(r[0]?.count ?? 0), total: Number(r[0]?.total ?? 0) })),

    // Invoices paid in last 24h (uses paidAt column)
    db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(total::numeric), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.status, 'paid'), isNotNull(invoices.paidAt), gte(invoices.paidAt, since)))
      .then(r => ({ count: Number(r[0]?.count ?? 0), total: Number(r[0]?.total ?? 0) })),

    // Delivery stops completed in last 24h (deliveries table has no updatedAt)
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${deliveryStops.deliveryId})` })
      .from(deliveryStops)
      .where(and(eq(deliveryStops.status, 'delivered'), isNotNull(deliveryStops.completedAt), gte(deliveryStops.completedAt, since)))
      .then(r => Number(r[0]?.count ?? 0)),

    // Tasting reports submitted in last 24h
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tastingReports)
      .where(gte(tastingReports.submittedAt, since))
      .then(r => Number(r[0]?.count ?? 0)),

    // New wholesale requests in last 24h
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(wholesaleAccountRequests)
      .where(gte(wholesaleAccountRequests.createdAt, since))
      .then(r => Number(r[0]?.count ?? 0)),

    // Admin users with phone numbers
    db
      .select({ id: users.id, name: users.name, phone: users.phone })
      .from(users)
      .where(and(eq(users.active, true), sql`${users.roles} @> ARRAY['admin']::text[]`))
      .then(r => r.filter(u => u.phone)),
  ])

  if (adminUsers.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No admin users with phone numbers' })
  }

  // Build the SMS — only include lines with non-zero values
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

  const lines: string[] = [`AHAWC Daily Update — ${today}`]

  const orderLine = fmt(newOrders.count)
  if (orderLine) {
    const val = fmtCurrency(newOrders.total)
    lines.push(`Orders: ${orderLine} new${val ? ` (${val})` : ''}`)
  }

  const paidLine = fmt(paidInvoices.count)
  if (paidLine) {
    const val = fmtCurrency(paidInvoices.total)
    lines.push(`Payments: ${paidLine} paid${val ? ` (${val})` : ''}`)
  }

  const deliveryLine = fmt(completedDeliveries)
  if (deliveryLine) lines.push(`Deliveries: ${deliveryLine} run${Number(completedDeliveries) !== 1 ? 's' : ''} completed`)

  const tastingLine = fmt(completedTastings)
  if (tastingLine) lines.push(`Tastings: ${tastingLine} report${Number(completedTastings) !== 1 ? 's' : ''} submitted`)

  const requestLine = fmt(newWholesaleRequests)
  if (requestLine) lines.push(`Wholesale requests: ${requestLine} new`)

  if (lines.length === 1) {
    lines.push('No activity in the last 24 hours.')
  }

  const message = lines.join('\n')

  let sent = 0
  let failed = 0

  for (const admin of adminUsers) {
    try {
      await sendSms({
        to: admin.phone!,
        body: message,
        bypassOptOut: true, // internal staff digest — not subject to opt-out
        userId: admin.id,
        contactName: admin.name,
      })
      sent++
    } catch (err) {
      console.error(`[admin-activity-sms] Failed to send to ${admin.name}:`, err)
      failed++
    }
  }

  return NextResponse.json({ sent, failed, recipients: adminUsers.length })
}
