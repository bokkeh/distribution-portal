import { asc, eq } from 'drizzle-orm'
import { writeFileSync } from 'node:fs'
import { db } from '../db'
import {
  customerAccounts,
  orderItems,
  orders,
  products,
  tastingReports,
  tastings,
  users,
} from '../db/schema'

async function main() {
  const [accountRows, orderRows, tastingRows, userRows, productRows] = await Promise.all([
    db.select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      city: customerAccounts.city,
      state: customerAccounts.state,
      address: customerAccounts.address,
      customerSegment: customerAccounts.customerSegment,
    })
      .from(customerAccounts)
      .where(eq(customerAccounts.customerSegment, 'b2b_wholesale'))
      .orderBy(asc(customerAccounts.companyName)),
    db.select({
      id: orders.id,
      customerId: orders.customerId,
      createdAt: orders.createdAt,
      status: orders.status,
      total: orders.total,
      notes: orders.notes,
      productName: products.name,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
      unitPrice: orderItems.unitPrice,
    })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(products.id, orderItems.productId))
      .orderBy(asc(orders.createdAt)),
    db.select({
      id: tastings.id,
      customerId: tastings.customerId,
      assignedUserId: tastings.assignedUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      endAt: tastings.endAt,
      status: tastings.status,
      notes: tastings.notes,
      reportId: tastingReports.id,
      samplesServed: tastingReports.samplesServed,
      bottlesSold: tastingReports.bottlesSold,
      casesSold: tastingReports.casesSold,
      consumerInteractions: tastingReports.consumerInteractions,
      bottlesInStockBefore: tastingReports.bottlesInStockBefore,
      accountFeedback: tastingReports.accountFeedback,
      highlights: tastingReports.highlights,
      issues: tastingReports.issues,
    })
      .from(tastings)
      .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
      .orderBy(asc(tastings.scheduledAt)),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(asc(users.name)),
    db.select({ id: products.id, sku: products.sku, name: products.name, price: products.price, bottlesPerCase: products.bottlesPerCase }).from(products).orderBy(asc(products.name)),
  ])

  const output = JSON.stringify({
    counts: {
      accounts: accountRows.length,
      orderLines: orderRows.length,
      tastings: tastingRows.length,
      users: userRows.length,
      products: productRows.length,
    },
    accounts: accountRows,
    orders: orderRows,
    tastings: tastingRows,
    users: userRows,
    products: productRows,
  }, null, 2)

  writeFileSync('tmp/crm_state.json', output)
  console.log(JSON.stringify({ counts: JSON.parse(output).counts, output: 'tmp/crm_state.json' }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
