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
    assert.deepEqual(await h.api.getFieldAccountTastings(saved.account.id),{last:null,upcoming:[]})
    assert.equal((await h.api.createFieldContact({requestId:randomUUID(),accountId:saved.account.id,name:'Rep client contact'})).success,true)
    assert.ok((await h.api.createFieldContact({requestId:randomUUID(),accountId:h.accountId,name:'Forbidden contact'})).error)
    const repContact=(await h.api.getFieldAccount(saved.account.id)).contacts[0]
    const edit={accountId:saved.account.id,contactId:repContact.id,name:'Edited rep contact',email:'',phone:'123',title:'Buyer',preferredContact:'call',isPrimary:false,expected:{name:repContact.name,email:'',phone:'',title:'',preferredContact:'',isPrimary:false}}
    assert.equal((await h.api.updateFieldContact(edit)).success,true)
    assert.ok((await h.api.updateFieldContact({...edit,accountId:h.accountId})).error)
    assert.ok((await h.api.updateFieldAccountContact({accountId:h.accountId,kind:'poc',name:'Forbidden',phone:'',email:'',expected:{name:'',phone:'',email:''}})).error)

    await assert.rejects(h.api.getFieldAccountTastings(h.accountId),/access/)
    await assert.rejects(h.api.getFieldAccount(h.accountId),/access/)
    const duplicate=await h.api.createFieldAccount({requestId:randomUUID(),companyName:'Test Venue'})
    assert.ok(duplicate.error);assert.deepEqual(duplicate.matches,[])
    h.runtime.session={user:{id:repId,role:'customer',roles:['customer']}}
    assert.ok((await h.api.createFieldAccount({requestId:randomUUID(),companyName:'Unauthorized'})).error)
  } finally {h.runtime.session=session}
})

test('photo saves accept upload proxy URLs and reject invalid paths', async () => {
 const photo={requestId:randomUUID(),accountId:h.accountId,mediaUrl:'/api/image?path=account-media%2Fgallery.jpg',caption:'Gallery',date:'2030-11-06'}
 assert.equal((await h.api.saveFieldPhoto(photo)).success,true)
 for(const mediaUrl of ['/api/image?path=documents%2Ffile.jpg','/api/image?path=account-media%2F..%2Fsecret','//evil.test/image','/api/image?path=account-media%2Fphoto.jpg&extra=1']) assert.ok((await h.api.saveFieldPhoto({...photo,requestId:randomUUID(),mediaUrl})).error)
})

test('account tasting history separates past, ongoing and future bookings at the end boundary', async t => {
  const accountId=randomUUID()
  await h.runtime.db.insert(h.api.schema.customerAccounts).values({id:accountId,companyName:'History boundary venue'})
  const make=(name,status,start,end,extra={})=>({id:randomUUID(),customerId:accountId,createdByUserId:h.runtime.session.user.id,eventName:name,status,scheduledAt:new Date(start),endAt:end?new Date(end):null,...extra})
  await h.runtime.db.insert(h.api.schema.tastings).values([
    make('Earlier completed','completed','2030-11-04T20:00:00Z','2030-11-04T23:00:00Z'),
    make('Ended exactly now','confirmed','2030-11-05T23:00:00Z','2030-11-06T02:00:00Z',{timeZone:'America/Los_Angeles',assignedUserId:h.rachelId}),
    make('Ongoing local previous day','scheduled','2030-11-06T01:00:00Z','2030-11-06T03:00:00Z'),
    make('No end ongoing','scheduled','2030-11-06T01:30:00Z',null),
    make('Cancelled','cancelled','2030-11-06T01:45:00Z','2030-11-06T02:00:00Z'),
    make('Declined future','declined','2030-11-06T03:00:00Z',null),
    make('Past request','requested','2030-11-05T00:00:00Z',null),
    ...Array.from({length:16},(_,i)=>make('Future '+i,i===0?'requested':'confirmed',new Date(Date.UTC(2030,10,7+i,21)).toISOString(),null)),
  ])
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2030-11-06T02:00:00Z')})
  try {
    const result=await h.api.getFieldAccountTastings(accountId)
    assert.equal(result.last.eventName,'Ended exactly now');assert.equal(result.last.assignee,'Rachel');assert.equal(result.last.timeZone,'America/Los_Angeles')
    assert.equal(result.upcoming.length,18)
    assert.deepEqual(result.upcoming.slice(0,3).map(row=>row.eventName),['Ongoing local previous day','No end ongoing','Future 0'])
    assert.equal(result.upcoming[2].status,'requested');assert.equal(result.upcoming[2].assignee,'Unassigned')
    assert.ok(result.upcoming.every(row=>typeof row.start==='string'))
    assert.deepEqual(await h.api.getFieldAccountTastings(randomUUID()).catch(error=>error.message),'You do not have access to this account.')
  } finally {t.mock.timers.reset()}
})

test('field contacts include linked people, primary order and account contact fields without leaking standalone or other-account contacts', async () => {
 const accountId=randomUUID()
 await h.runtime.db.insert(h.api.schema.customerAccounts).values({id:accountId,companyName:'Contact Card Venue',pocName:'Venue buyer',pocPhone:'4105550111',pocEmail:'buyer@example.test',businessPhone:'4105550120',businessEmail:'venue@example.test'})
 await h.runtime.db.insert(h.api.schema.contacts).values([
  {customerId:accountId,name:'Z Primary',isPrimary:true,title:'Buyer',email:'primary@example.test',phone:'4105550130',preferredContact:'call'},
  {customerId:accountId,name:'A Secondary',title:'Manager'},
  {customerId:null,name:'Unlinked person',email:'private@example.test'},
  {customerId:h.accountId,name:'Other account person'},
 ])
 const result=await h.api.getFieldAccount(accountId)
 assert.deepEqual(result.contacts.map(contact=>contact.name),['Z Primary','A Secondary'])
 assert.equal(result.contacts[0].title,'Buyer');assert.equal(result.contacts[0].preferredContact,'call')
 assert.deepEqual(result.pointOfContact,{name:'Venue buyer',phone:'4105550111',email:'buyer@example.test'})
 assert.deepEqual(result.businessContact,{phone:'4105550120',email:'venue@example.test'})
 const empty=await h.api.createFieldAccount({requestId:randomUUID(),companyName:'No contacts card venue'})
 assert.deepEqual(empty.account.contacts,[]);assert.equal(empty.account.pointOfContact.name,null)
})

test('quick field contact creation is minimal, linked, retry-safe and preserves existing primaries', async () => {
 const accountId=randomUUID()
 await h.runtime.db.insert(h.api.schema.customerAccounts).values({id:accountId,companyName:'Quick contact venue'})
 const primaryId=randomUUID()
 await h.runtime.db.insert(h.api.schema.contacts).values({id:primaryId,customerId:accountId,name:'Existing primary',isPrimary:true})
 const input={requestId:randomUUID(),accountId,name:'Field buyer',email:'Buyer@example.test',phone:'410-555-0100',title:'Buyer',preferredContact:'call',isPrimary:true}
 const saved=await h.api.createFieldContact(input)
 assert.equal(saved.success,true,saved.error)
 assert.equal(saved.account.contacts.find(contact=>contact.id===input.requestId).email,'buyer@example.test')
 assert.equal((await h.api.createFieldContact(input)).success,true)
 assert.ok((await h.api.createFieldContact({...input,name:'Changed after save'})).error)
 assert.ok((await h.api.createFieldContact({...input,requestId:randomUUID(),name:'Duplicate email'})).error)
 assert.equal((await h.runtime.db.select().from(h.api.schema.contacts).where(eq(h.api.schema.contacts.id,input.requestId))).length,1)
 assert.equal((await h.runtime.db.select().from(h.api.schema.contacts).where(eq(h.api.schema.contacts.id,primaryId)))[0].isPrimary,true)
 const minimal={requestId:randomUUID(),accountId,name:'Name only person'}
 const results=await Promise.all([h.api.createFieldContact(minimal),h.api.createFieldContact(minimal)])
 assert.ok(results.every(result=>result.success))
 const [row]=await h.runtime.db.select().from(h.api.schema.contacts).where(eq(h.api.schema.contacts.id,minimal.requestId))
 assert.equal(row.customerId,accountId);assert.equal(row.email,null);assert.equal(row.phone,null);assert.equal(row.isPrimary,false)
 assert.ok((await h.api.createFieldContact({...minimal,requestId:randomUUID(),name:''})).error)
 assert.ok((await h.api.createFieldContact({...minimal,requestId:randomUUID(),email:'bad email'})).error)
 assert.ok(h.runtime.paths.includes('/admin/crm/'+accountId+'/contacts'))
})

test('field availability carries each active taster photo through to its booking card', async () => {
 const avatarUrl='https://storage.googleapis.com/test-bucket/avatars/rachel.jpg'
 await h.runtime.db.update(h.api.schema.users).set({avatarUrl}).where(eq(h.api.schema.users.id,h.rachelId))
 const data=await h.api.getFieldAvailability()
 assert.equal(data.tasters.find(taster=>taster.id===h.rachelId).avatarUrl,avatarUrl)
 const rows=h.api.fieldAvailabilityRows({...data,dates:[{userId:h.rachelId,date:'2030-11-06'}]})
 assert.equal(rows[0].avatarUrl,avatarUrl);assert.equal(rows[0].name,'Rachel')
 assert.equal(h.api.fieldAvailabilityRows({tasters:[{id:h.rachelId,name:'Rachel'}],dates:[{userId:h.rachelId,date:'2030-11-07'}],bookings:[]})[0].avatarUrl,null)
})


test('field contact edits update the CRM row, retain metadata, reject stale edits and safely confirm retries', async () => {
 const id=randomUUID(), otherId=randomUUID()
 await h.runtime.db.insert(h.api.schema.contacts).values({id,customerId:h.accountId,name:'Original buyer',phoneType:'mobile',notes:'Preserve notes',relationshipStatus:'keep_in_touch',title:'Buyer'})
 await h.runtime.db.insert(h.api.schema.customerAccounts).values({id:otherId,companyName:'Other edit account'})
 const original=(await h.api.getFieldAccount(h.accountId)).contacts.find(row=>row.id===id)
 const expected={name:original.name,email:original.email??'',phone:original.phone??'',title:original.title??'',preferredContact:original.preferredContact??'',isPrimary:original.isPrimary}
 const input={accountId:h.accountId,contactId:id,expected,name:'Updated buyer',email:'BUYER@EXAMPLE.TEST',phone:'410-555-0987',title:'Purchasing director',preferredContact:'email',isPrimary:true}
 assert.equal((await h.api.updateFieldContact(input)).success,true)
 assert.equal((await h.api.updateFieldContact(input)).success,true)
 const [crmRow]=await h.runtime.db.select().from(h.api.schema.contacts).where(eq(h.api.schema.contacts.id,id))
 assert.equal(crmRow.name,'Updated buyer');assert.equal(crmRow.email,'buyer@example.test');assert.equal(crmRow.title,'Purchasing director')
 assert.equal(crmRow.phoneType,'mobile');assert.equal(crmRow.notes,'Preserve notes');assert.equal(crmRow.relationshipStatus,'keep_in_touch')
 assert.ok((await h.api.updateFieldContact({...input,name:'Stale overwrite'})).error)
 assert.ok((await h.api.updateFieldContact({...input,accountId:otherId})).error)
 assert.ok((await h.api.updateFieldContact({...input,email:'invalid'})).error)
 assert.ok(h.runtime.paths.includes('/admin/crm/people/'+id))
 const snapshot={name:crmRow.name,email:crmRow.email,phone:crmRow.phone,title:crmRow.title,preferredContact:crmRow.preferredContact,isPrimary:crmRow.isPrimary}
 await h.runtime.db.update(h.api.schema.contacts).set({title:'Changed in core CRM'}).where(eq(h.api.schema.contacts.id,id))
 assert.ok((await h.api.updateFieldContact({...input,expected:snapshot,phone:'410-555-0888'})).error)
 assert.equal((await h.api.getFieldAccount(h.accountId)).contacts.find(row=>row.id===id).title,'Changed in core CRM')
})

test('field edits persist native account contacts and business fallbacks without creating people', async () => {
 const id=randomUUID()
 await h.runtime.db.insert(h.api.schema.customerAccounts).values({id,companyName:'Native contact account',pocName:'POC',pocPhone:'123',phone:'456',email:'business@example.test',businessPhone:'789'})
 const before=(await h.runtime.db.select().from(h.api.schema.contacts)).length
 const poc={accountId:id,kind:'poc',name:'Updated POC',phone:'321',email:'poc@example.test',expected:{name:'POC',phone:'123',email:''}}
 assert.equal((await h.api.updateFieldAccountContact(poc)).success,true)
 assert.equal((await h.api.updateFieldAccountContact(poc)).success,true)
 assert.ok((await h.api.updateFieldAccountContact({...poc,name:'Old form overwrite'})).error)
 const business={accountId:id,kind:'business',name:'',phone:'987',email:'updated@example.test',expected:{name:'',phone:'789',email:'business@example.test'}}
 assert.equal((await h.api.updateFieldAccountContact(business)).success,true)
 const [crm]=await h.runtime.db.select().from(h.api.schema.customerAccounts).where(eq(h.api.schema.customerAccounts.id,id))
 assert.equal(crm.pocName,'Updated POC');assert.equal(crm.pocEmail,'poc@example.test');assert.equal(crm.businessPhone,'987');assert.equal(crm.phone,'456');assert.equal(crm.email,'updated@example.test')
 const cleared=await h.api.updateFieldAccountContact({...business,phone:'',email:'',expected:{name:'',phone:'987',email:'updated@example.test'}})
 assert.equal(cleared.success,true);assert.equal(cleared.account.businessContact.phone,null);assert.equal(cleared.account.businessContact.email,null)
 assert.equal((await h.runtime.db.select().from(h.api.schema.contacts)).length,before)
})
