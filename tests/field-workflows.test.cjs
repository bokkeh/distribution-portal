/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server-action regression tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { eq } = require('drizzle-orm')
const { createHarness } = require('./operator-harness.cjs')

let h
test.before(async () => { process.env.INVOICE_PUBLIC_LINK_SECRET = 'isolated-field-tests-only'; h = await createHarness(); await h.runtime.db.insert(h.api.schema.inventory).values({ productId: h.productId, quantityPaid: 40 }) })
test.after(async () => h?.pg.close())
const entry = overrides => ({ requestId: randomUUID(), accountId: h.accountId, kind: 'order', paymentMethod: 'check', email: 'client@example.test', notes: 'Field visit', items: [{ productId: h.productId, quantity: 2 }], tax: '0', ...overrides })
async function reviewed(input) { const quote = await h.api.quoteFieldDocument(input); assert.equal(quote.success, true, quote.error); return { ...input, quotedTotal: quote.total } }

test('field order review uses account prices; one request creates one order and invoice, with unpaid check selection', async () => {
  const input = await reviewed(entry({ tax: '4.60' }))
  assert.equal(input.quotedTotal, '204.60')
  const saved = await h.api.saveFieldDocument(input)
  assert.equal(saved.success, true, saved.error)
  assert.equal((await h.api.saveFieldDocument(input)).invoiceId, saved.invoiceId)
  const [order] = await h.runtime.db.select().from(h.api.schema.orders).where(eq(h.api.schema.orders.id, saved.orderId))
  assert.equal(order.paymentMethod, 'check'); assert.equal(order.paymentStatus, 'unpaid'); assert.equal(order.isAssisted, true)
  assert.equal(order.total, '204.60')
  const [inv] = await h.runtime.db.select().from(h.api.schema.inventory)
  assert.equal(inv.quantityPaid, 38)
  assert.match(saved.paymentPath, /^\/pay\//)
  assert.ok((await h.api.saveFieldDocument({ ...input, notes: 'changed retry' })).error)
})

test('quick invoice does not create an order or change stock, and failed email does not undo the saved invoice', async () => {
  const ordersBefore = (await h.runtime.db.select().from(h.api.schema.orders)).length
  const input = await reviewed(entry({ kind: 'invoice', items: [], description: 'Client service', amount: '25.50', paymentMethod: 'cod' }))
  const saved = await h.api.saveFieldDocument(input)
  assert.equal(saved.success, true, saved.error); assert.equal(saved.orderId, null)
  assert.equal((await h.runtime.db.select().from(h.api.schema.orders)).length, ordersBefore)
  assert.equal((await h.runtime.db.select().from(h.api.schema.inventory))[0].quantityPaid, 38)
  assert.ok((await h.api.sendFieldInvoice(saved.requestId)).error)
  const document = await h.api.getFieldDocument(saved.requestId)
  assert.equal(document.status, 'draft'); assert.equal(document.emailSentAt, null)
  h.runtime.emailSuccess = true
  assert.equal((await h.api.sendFieldInvoice(saved.requestId)).success, true)
  const calls = h.runtime.emailCalls
  assert.equal((await h.api.sendFieldInvoice(saved.requestId)).success, true)
  assert.equal(h.runtime.emailCalls, calls)
  assert.equal((await h.api.getFieldDocument(saved.requestId)).status, 'sent')
  await assert.rejects(h.api.startFieldCardPayment(saved.requestId), /check or COD/)
})

test('concurrent reservations are atomic and competing retries cannot oversell or create partial financial rows', async () => {
  await h.runtime.db.update(h.api.schema.inventory).set({ quantityPaid: 3 })
  const first = await reviewed(entry({ paymentMethod: 'cod' }))
  const second = await reviewed(entry({ paymentMethod: 'cod' }))
  const before = (await h.runtime.db.select().from(h.api.schema.orders)).length
  const log = console.error; console.error = () => {}
  let results
  try { results = await Promise.all([h.api.saveFieldDocument(first), h.api.saveFieldDocument(second)]) } finally { console.error = log }
  assert.equal(results.filter(row => row.success).length, 1)
  assert.equal((await h.runtime.db.select().from(h.api.schema.orders)).length, before + 1)
  assert.equal((await h.runtime.db.select().from(h.api.schema.inventory))[0].quantityPaid, 1)
  const success = results.find(row => row.success)
  const retryInput = results[0].success ? first : second
  assert.equal((await h.api.saveFieldDocument(retryInput)).invoiceId, success.invoiceId)
})

test('unreviewed totals, fractional cases and unauthorized accounts are rejected without financial writes', async () => {
  assert.ok((await h.api.saveFieldDocument(entry())).error)
  assert.ok((await h.api.quoteFieldDocument(entry({ items: [{ productId: h.productId, quantity: 0.5 }] }))).error)
  const session = h.runtime.session
  try {
    h.runtime.session = { user: { ...session.user, role: 'sales_rep', roles: ['sales_rep'] } }
    assert.ok((await h.api.quoteFieldDocument(entry())).error)
    await assert.rejects(h.api.getFieldAccount(h.accountId), /active sales profile/)
  } finally { h.runtime.session = session }
})

test('Stripe initialization authorizes only the selected field invoice and never marks it paid', async () => {
  const input = await reviewed(entry({ kind: 'invoice', items: [], description: 'Card invoice', amount: '10', paymentMethod: 'stripe' }))
  const saved = await h.api.saveFieldDocument(input)
  const payment = await h.api.startFieldCardPayment(saved.requestId)
  assert.equal(payment.clientSecret, 'test-secret')
  assert.equal((await h.api.getFieldDocument(saved.requestId)).status, 'sent')
})

test('availability shows declared dates and excludes overlapping windows, allowing adjacent bookings', () => {
  const data = { tasters: [{ id: h.rachelId, name: 'Rachel' }], dates: [{ userId: h.rachelId, date: '2030-11-06' }, { userId: h.rachelId, date: '2030-11-07' }], bookings: [{ userId: h.rachelId, start: '2030-11-06T21:00:00Z', end: '2030-11-07T00:00:00Z', timeZone: 'America/New_York' }] }
  const rows = h.api.fieldAvailabilityRows(data)
  assert.equal(rows[0].free, false); assert.equal(rows[1].free, true)
  assert.equal(h.api.fieldAvailabilityRows(data, '19:00', '20:00')[0].free, true)
  assert.deepEqual(h.api.fieldAvailabilityRows({ ...data, dates: [] }), [])
  assert.equal(h.api.fieldLoginReturn('/field?invoice=123'), '/field?invoice=123')
  assert.equal(h.api.fieldLoginReturn('//evil.test'), null)
  assert.equal(h.api.fieldLoginReturn('/field-other'), null)
})

test('invoice can save without email and accept a recipient later', async () => {
  const input = await reviewed(entry({ kind: 'invoice', items: [], description: 'Share later', amount: '12', email: '' }))
  const saved = await h.api.saveFieldDocument(input)
  assert.equal(saved.success, true, saved.error)
  assert.ok((await h.api.sendFieldInvoice(saved.requestId)).error)
  h.runtime.emailSuccess = true
  assert.equal((await h.api.sendFieldInvoice(saved.requestId, 'later@example.test')).success, true)
  assert.equal((await h.api.getFieldDocument(saved.requestId)).email, 'later@example.test')
})

test('note and photo retries preserve one record and reject changed payloads', async () => {
  const noteId = randomUUID()
  assert.equal((await h.api.saveFieldNote(h.accountId, 'Visit notes', noteId)).success, true)
  assert.equal((await h.api.saveFieldNote(h.accountId, 'Visit notes', noteId)).success, true)
  assert.ok((await h.api.saveFieldNote(h.accountId, 'Changed note', noteId)).error)
  assert.equal((await h.runtime.db.select().from(h.api.schema.accountNotes).where(eq(h.api.schema.accountNotes.id, noteId))).length, 1)
  const photo = { requestId: randomUUID(), accountId: h.accountId, mediaUrl: 'https://storage.googleapis.com/test/photo.jpg', caption: 'Shelf', date: '2030-11-06' }
  assert.equal((await h.api.saveFieldPhoto(photo)).success, true)
  assert.equal((await h.api.saveFieldPhoto(photo)).success, true)
  assert.ok((await h.api.saveFieldPhoto({ ...photo, caption: 'Changed' })).error)
  assert.equal((await h.runtime.db.select().from(h.api.schema.accountMedia).where(eq(h.api.schema.accountMedia.id, photo.requestId))).length, 1)
})

test('saved-product invoice uses account pricing and persists case lines without an order or stock requirement', async () => {
  const productId=randomUUID()
  await h.runtime.db.insert(h.api.schema.products).values({id:productId,name:'Wisher Case',sku:'WISHER-CASE',unit:'case',price:'120',bottlesPerCase:12})
  await h.runtime.db.insert(h.api.schema.geographicPricingRules).values({productId,accountId:h.accountId,ruleType:'account',casePrice:'95',effectiveStartDate:new Date('2020-01-01')})
  const ordersBefore=(await h.runtime.db.select().from(h.api.schema.orders)).length
  const stockBefore=await h.runtime.db.select().from(h.api.schema.inventory)
  const input=await reviewed(entry({kind:'invoice',items:[{productId,quantity:3}],tax:'5',notes:'Shelf delivery'}))
  assert.equal(input.quotedTotal,'290.00')
  const saved=await h.api.saveFieldDocument(input)
  assert.equal(saved.success,true,saved.error);assert.equal(saved.orderId,null)
  const [line]=await h.runtime.db.select().from(h.api.schema.invoiceItems).where(eq(h.api.schema.invoiceItems.invoiceId,saved.invoiceId))
  assert.equal(line.productId,productId);assert.equal(line.sku,'WISHER-CASE');assert.equal(line.quantity,'3.00');assert.equal(line.unit,'case');assert.equal(line.unitPrice,'95.00');assert.equal(line.total,'285.00')
  assert.match(line.description,/Shelf delivery/)
  assert.equal((await h.api.saveFieldDocument(input)).invoiceId,saved.invoiceId)
  assert.equal((await h.runtime.db.select().from(h.api.schema.invoiceItems).where(eq(h.api.schema.invoiceItems.invoiceId,saved.invoiceId))).length,1)
  assert.deepEqual(await h.runtime.db.select().from(h.api.schema.inventory),stockBefore)
  assert.equal((await h.runtime.db.select().from(h.api.schema.orders)).length,ordersBefore)
  assert.ok((await h.api.quoteFieldDocument(entry({items:[{productId,quantity:3}]}))).error)
  assert.ok((await h.api.quoteFieldDocument(entry({kind:'invoice',items:[{productId,quantity:3},{productId,quantity:1}]}))).error)
  assert.ok((await h.api.quoteFieldDocument(entry({kind:'invoice',items:[{productId,quantity:3}],amount:'1',description:'Ambiguous'}))).error)
  await h.runtime.db.update(h.api.schema.products).set({active:false}).where(eq(h.api.schema.products.id,productId))
  assert.ok((await h.api.quoteFieldDocument(entry({kind:'invoice',items:[{productId,quantity:3}]}))).error)
})

test('field account creation is lightweight, immediately selectable and retry-safe, with duplicate matching', async () => {
  const input={requestId:randomUUID(),companyName:'New Field Venue',city:'Baltimore',state:'md',email:'new@example.test'}
  const saved=await h.api.createFieldAccount(input)
  assert.equal(saved.success,true,saved.error);assert.equal(saved.account.companyName,input.companyName);assert.equal(saved.account.state,'MD')
  assert.equal((await h.api.searchFieldAccounts('New Field Venue'))[0].id,saved.account.id)
  assert.equal((await h.api.createFieldAccount(input)).account.id,saved.account.id)
  assert.ok((await h.api.createFieldAccount({...input,email:'changed@example.test'})).error)
  const duplicate=await h.api.createFieldAccount({...input,requestId:randomUUID(),companyName:'NEW FIELD VENUE'})
  assert.ok(duplicate.error);assert.equal(duplicate.matches[0].id,saved.account.id)
  const minimal=await h.api.createFieldAccount({requestId:randomUUID(),companyName:'Minimal Field Venue'})
  assert.equal(minimal.success,true,minimal.error)
  const [record]=await h.runtime.db.select().from(h.api.schema.customerAccounts).where(eq(h.api.schema.customerAccounts.id,minimal.account.id))
  assert.equal(record.dealStage,null);assert.equal(record.userId,null)
  const concurrent={requestId:randomUUID(),companyName:'Concurrent Venue'}
  const results=await Promise.all([h.api.createFieldAccount(concurrent),h.api.createFieldAccount(concurrent)])
  assert.ok(results.every(row=>row.success));assert.equal(results[0].account.id,results[1].account.id)
  assert.equal((await h.runtime.db.select().from(h.api.schema.customerAccounts).where(eq(h.api.schema.customerAccounts.id,concurrent.requestId))).length,1)
})

test('sales field accounts are assigned to the creator and duplicate results respect account scope', async () => {
  const session=h.runtime.session,repId=randomUUID(),memberId=randomUUID()
  await h.runtime.db.insert(h.api.schema.users).values({id:repId,name:'Field rep',email:'rep@example.test',passwordHash:'test',role:'sales_rep',roles:['sales_rep']})
  await h.runtime.db.insert(h.api.schema.salesMembers).values({id:memberId,userId:repId,status:'active',name:'Field rep'})
  try {
    h.runtime.session={user:{id:repId,role:'sales_rep',roles:['sales_rep'],name:'Field rep'}}
    const saved=await h.api.createFieldAccount({requestId:randomUUID(),companyName:'Rep Field Client'})
    assert.equal(saved.success,true,saved.error)
    const [record]=await h.runtime.db.select().from(h.api.schema.customerAccounts).where(eq(h.api.schema.customerAccounts.id,saved.account.id))
    assert.equal(record.assignedSalesRepId,memberId)
    const duplicate=await h.api.createFieldAccount({requestId:randomUUID(),companyName:'Test Venue'})
    assert.ok(duplicate.error);assert.deepEqual(duplicate.matches,[])
    h.runtime.session={user:{id:repId,role:'customer',roles:['customer']}}
    assert.ok((await h.api.createFieldAccount({requestId:randomUUID(),companyName:'Unauthorized'})).error)
  } finally {h.runtime.session=session}
})
