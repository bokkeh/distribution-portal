/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const { eq } = require('drizzle-orm')
const { randomUUID } = require('node:crypto')
const { createHarness } = require('./operator-harness.cjs')
let h
test.before(async () => {
  process.env.INVOICE_PUBLIC_LINK_SECRET = 'isolated-invoice-test-only'
  h = await createHarness({ entry: 'tests/fixtures/invoice-workflow-entry.ts', stubs: {
    '@/actions/sales-members': 'export async function calculateCommissionForOrder() { return { amount: 0 } } export async function recordCommission() {}',
    '@/lib/notifications/dispatch': 'export async function notify() {}',
    '@/lib/inventory/history': 'export async function logInventoryTransaction() {}',
    '@/lib/orders/account-inventory': 'export async function syncOrderAccountInventory() {}',
    '@/lib/activity/log': 'export async function logActivityEvent(event) { globalThis.__operatorTest.events = [...(globalThis.__operatorTest.events ?? []), event] }',
    '@/lib/resend/client': 'export async function sendFieldInvoiceEmail(input) { globalThis.__operatorTest.messages = [...(globalThis.__operatorTest.messages ?? []), input]; return globalThis.__operatorTest.emailSuccess ?? false } export const sendRepAssistedOrderEmail = sendFieldInvoiceEmail;',
  } })
  await h.runtime.db.insert(h.api.schema.inventory).values({ productId: h.productId, quantityPaid: 40, quantitySample: 5 })
})
test.after(async () => h?.pg.close())
const orderForm = overrides => {
  const form = new FormData()
  for (const [key, value] of Object.entries({ customerId: h.accountId, orderType: 'paid', purchaseUnit: 'case', paymentType: 'cod', items: JSON.stringify([{ productId: h.productId, quantity: 2 }]), ...overrides })) form.set(key, value)
  return form
}
let invoiceId, orderId
test('creating an ordinary unpaid order atomically saves a draft and product/fee snapshot without emailing', async () => {
  const result = await h.api.createOrder(orderForm({ deliveryTiming: 'time_sensitive', preferredDeliveryDay: 'saturday' }))
  assert.equal(result.success, true, result.error); orderId = result.orderId
  const [invoice] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.orderId, orderId))
  invoiceId = invoice.id
  assert.equal(invoice.status, 'draft'); assert.equal(invoice.total, '250.00'); assert.equal(invoice.amount, '250.00')
  const lines = await h.runtime.db.select().from(h.api.schema.invoiceItems).where(eq(h.api.schema.invoiceItems.invoiceId, invoiceId))
  assert.equal(lines.length, 2); assert.equal(lines.reduce((n, row) => n + Number(row.total), 0), 250)
  assert.equal(h.runtime.messages?.length ?? 0, 0)
})
test('invoice failure rolls back order and order items in the same transaction', async () => {
  const before = await h.runtime.db.select().from(h.api.schema.orders)
  await h.pg.exec("ALTER TABLE invoices ADD CONSTRAINT invoice_test_failure CHECK (total <> 200)")
  const result = await h.api.createOrder(orderForm())
  assert.ok(result.error)
  assert.equal((await h.runtime.db.select().from(h.api.schema.orders)).length, before.length)
  await h.pg.exec('ALTER TABLE invoices DROP CONSTRAINT invoice_test_failure')
})
test('sample orders do not create invoices', async () => {
  const result = await h.api.createOrder(orderForm({ orderType: 'sample' }))
  assert.equal(result.success, true, result.error)
  assert.equal((await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.orderId, result.orderId))).length, 0)
})
test('failed sending retains the saved draft; success and resending preserve invoice identity and record chosen recipients', async () => {
  const form = new FormData(); form.set('recipientEmail', 'bookkeeper@example.test'); form.set('portal', 'field')
  await assert.rejects(h.api.sendInvoiceEmail(invoiceId, form), e => e.url?.includes('error='))
  assert.equal((await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.id, invoiceId)))[0].status, 'draft')
  h.runtime.emailSuccess = true
  await assert.rejects(h.api.sendInvoiceEmail(invoiceId, form), e => e.url?.startsWith(`/field/invoices/${invoiceId}?success=`))
  const [saved] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.id, invoiceId))
  form.set('recipientEmail', 'other@example.test')
  await assert.rejects(h.api.sendInvoiceEmail(invoiceId, form), e => e.url?.includes('success='))
  const [resent] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.id, invoiceId))
  assert.equal(resent.invoiceNumber, saved.invoiceNumber); assert.equal(resent.status, 'sent')
  assert.equal(h.runtime.events.at(-1).metadata.recipientEmail, 'other@example.test')
  assert.match(h.runtime.messages.at(-1).invoicePath, /^\/pay\//)
})
test('invalid recipient and unauthorized users cannot send; paid invoices stay paid on resend', async () => {
  const form = new FormData(); form.set('recipientEmail', 'invalid')
  const count = h.runtime.messages.length
  await assert.rejects(h.api.sendInvoiceEmail(invoiceId, form), e => e.url?.includes('error='))
  assert.equal(h.runtime.messages.length, count)
  h.runtime.session.user.roles = ['sales_rep']
  await assert.rejects(h.api.sendInvoiceEmail(invoiceId, form), /Unauthorized/)
  h.runtime.session.user.roles = ['admin']
  await h.runtime.db.update(h.api.schema.invoices).set({ status: 'paid' }).where(eq(h.api.schema.invoices.id, invoiceId))
  form.set('recipientEmail', 'receipt@example.test')
  await assert.rejects(h.api.sendInvoiceEmail(invoiceId, form), e => e.url?.includes('success='))
  assert.equal((await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.id, invoiceId)))[0].status, 'paid')
})
test('already paid orders produce paid invoices and cannot be charged again', async () => {
  const result = await h.api.createOrder(orderForm({ paymentType: 'paid' }))
  assert.equal(result.success, true, result.error)
  const [invoice] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.orderId, result.orderId))
  assert.equal(invoice.status, 'paid'); assert.ok(invoice.paidAt)
  await assert.rejects(h.api.createPaymentIntent(invoice.id, 'card'), /already paid/)
})
test('snapshot product descriptions do not change when products are renamed', async () => {
  await h.runtime.db.update(h.api.schema.products).set({ name: 'Renamed product' }).where(eq(h.api.schema.products.id, h.productId))
  const lines = await h.runtime.db.select().from(h.api.schema.invoiceItems).where(eq(h.api.schema.invoiceItems.invoiceId, invoiceId))
  assert.equal(lines[0].description, 'Test Vodka')
})
test('rep-assisted submission saves a draft without notifications; explicit email uses the selected address and same invoice', async () => {
  const form = orderForm({ accountMode: 'existing', email: 'buyer@example.test', phone: '4105550100', idempotencyKey: randomUUID() })
  const before = h.runtime.messages.length
  const result = await h.api.submitRepAssistedOrder(form)
  assert.equal(result.success, true, result.error)
  const [workflow] = await h.runtime.db.select().from(h.api.schema.repAssistedOrders).where(eq(h.api.schema.repAssistedOrders.id, result.workflowId))
  const [invoice] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.id, workflow.invoiceId))
  assert.equal(invoice.status, 'draft'); assert.equal(workflow.emailStatus, 'pending'); assert.equal(workflow.smsStatus, 'pending')
  assert.equal(h.runtime.messages.length, before)
  assert.equal((await h.api.submitRepAssistedOrder(form)).workflowId, workflow.id)
  const count = (await h.runtime.db.select().from(h.api.schema.invoices)).length
  assert.equal((await h.api.resendRepAssistedNotification(workflow.id, 'email', 'accountant@example.test')).success, true)
  assert.equal(h.runtime.messages.at(-1).to, 'accountant@example.test')
  assert.equal((await h.runtime.db.select().from(h.api.schema.invoices)).length, count)
  const [sent] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.id, invoice.id))
  assert.equal(sent.invoiceNumber, invoice.invoiceNumber); assert.equal(sent.status, 'sent')
})

test('checkout payment webhooks settle the automatically saved invoice without creating another charge', async () => {
  const result = await h.api.createOrder(orderForm())
  assert.equal(result.success, true, result.error)
  const intentId = 'pi_isolated_checkout'
  await h.runtime.db.update(h.api.schema.orders).set({ stripePaymentIntentId: intentId, paymentStatus: 'processing' }).where(eq(h.api.schema.orders.id, result.orderId))
  await h.runtime.db.update(h.api.schema.invoices).set({ stripePaymentIntentId: intentId }).where(eq(h.api.schema.invoices.orderId, result.orderId))
  await h.api.applyWebhookOrderPaymentUpdate(intentId, 'succeeded', h.runtime.session.user.id)
  const [invoice] = await h.runtime.db.select().from(h.api.schema.invoices).where(eq(h.api.schema.invoices.orderId, result.orderId))
  assert.equal(invoice.status, 'paid'); assert.ok(invoice.paidAt)
})
