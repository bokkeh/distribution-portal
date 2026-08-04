import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@/db'
import {
  inventoryLocationMovements,
  inventoryLocations,
  inventoryLowStockAlerts,
  monthlyInventoryReports,
  products,
  quickBooksExports,
  users,
} from '@/db/schema'
import { sendMonthlyInventoryReportEmail } from '@/lib/resend/client'
import { previousMonthWindow } from '@/lib/inventory/report-period'

function csvCell(value: unknown) {
  const string = String(value ?? '')
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string
}

async function reportRecipients() {
  const configured = (process.env.MONTHLY_INVENTORY_REPORT_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  if (configured.length) return [...new Set(configured)]
  const people = await db.select({ email: users.email, name: users.name }).from(users)
    .where(and(eq(users.active, true), inArray(users.role, ['admin', 'staff'])))
  const allowedNames = new Set(['kris', 'kim', 'alex', 'emily'])
  return [...new Set(people.filter((person) => allowedNames.has(person.name.trim().split(/\s+/)[0].toLowerCase())).map((person) => person.email.toLowerCase()))]
}

export async function generateAndSendMonthlyInventoryReport(now = new Date()) {
  const { start, end, reportMonth } = previousMonthWindow(now)
  const [existing] = await db.select().from(monthlyInventoryReports).where(eq(monthlyInventoryReports.reportMonth, reportMonth)).limit(1)
  if (existing?.status === 'sent') return { report: existing, alreadySent: true }

  const [report] = existing ? [existing] : await db.insert(monthlyInventoryReports).values({ reportMonth }).returning()
  const rows = await db.select({
    createdAt: inventoryLocationMovements.createdAt,
    type: inventoryLocationMovements.type,
    sku: products.sku,
    productName: products.name,
    source: inventoryLocations.name,
    destinationId: inventoryLocationMovements.destinationLocationId,
    cases: inventoryLocationMovements.quantityCases,
    bottles: inventoryLocationMovements.quantityBottles,
    category: inventoryLocationMovements.quickBooksCategory,
    estimatedCost: inventoryLocationMovements.estimatedCost,
    requestId: inventoryLocationMovements.sampleRequestId,
    reason: inventoryLocationMovements.reason,
  }).from(inventoryLocationMovements)
    .innerJoin(products, eq(products.id, inventoryLocationMovements.productId))
    .leftJoin(inventoryLocations, eq(inventoryLocations.id, inventoryLocationMovements.sourceLocationId))
    .where(and(gte(inventoryLocationMovements.createdAt, start), lt(inventoryLocationMovements.createdAt, end)))
    .orderBy(asc(inventoryLocationMovements.createdAt))

  const locationNames = await db.select({ id: inventoryLocations.id, name: inventoryLocations.name }).from(inventoryLocations)
  const locationMap = new Map(locationNames.map((location) => [location.id, location.name]))
  const lowStock = await db.select({ id: inventoryLowStockAlerts.id }).from(inventoryLowStockAlerts).where(eq(inventoryLowStockAlerts.status, 'open'))
  const attentionExports = await db.select({ id: quickBooksExports.id }).from(quickBooksExports).where(inArray(quickBooksExports.status, ['pending_mapping', 'failed']))
  const totalEstimatedCost = rows.reduce((sum, row) => sum + Number(row.estimatedCost), 0)
  const summary = { movementCount: rows.length, totalEstimatedCost, lowStockCount: lowStock.length, failedExportCount: attentionExports.length }
  const header = ['Date', 'Type', 'SKU', 'Product', 'Source', 'Destination', 'Cases', 'Bottles', 'QuickBooks Category', 'Estimated Cost', 'Sample Request ID', 'Reason']
  const csv = [header, ...rows.map((row) => [row.createdAt.toISOString(), row.type, row.sku, row.productName, row.source, row.destinationId ? locationMap.get(row.destinationId) : '', row.cases, row.bottles, row.category, row.estimatedCost, row.requestId, row.reason])]
    .map((row) => row.map(csvCell).join(',')).join('\n')
  const recipients = await reportRecipients()

  await db.update(monthlyInventoryReports).set({ status: 'sending', summary, csvContent: csv, recipientEmails: recipients, generatedAt: new Date(), updatedAt: new Date(), lastError: null }).where(eq(monthlyInventoryReports.id, report.id))
  const sent = new Set(report.sentRecipientEmails ?? [])
  const failures: string[] = []
  for (const recipient of recipients) {
    if (sent.has(recipient)) continue
    const ok = await sendMonthlyInventoryReportEmail({ to: recipient, reportMonth, summary, reportId: report.id })
    if (ok) sent.add(recipient)
    else failures.push(recipient)
    await db.update(monthlyInventoryReports).set({ sentRecipientEmails: [...sent], updatedAt: new Date() }).where(eq(monthlyInventoryReports.id, report.id))
  }
  const status = failures.length ? (sent.size ? 'partially_sent' : 'failed') : 'sent'
  const [updated] = await db.update(monthlyInventoryReports).set({ status, sentRecipientEmails: [...sent], sentAt: status === 'sent' ? new Date() : null, lastError: failures.length ? `Failed recipients: ${failures.join(', ')}` : null, updatedAt: new Date() }).where(eq(monthlyInventoryReports.id, report.id)).returning()
  return { report: updated, alreadySent: false }
}
