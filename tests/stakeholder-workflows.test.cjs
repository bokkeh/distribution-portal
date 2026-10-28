/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { eq } = require('drizzle-orm')
process.env.RESEND_API_KEY = 'test_mock_only'
process.env.RESEND_FROM_EMAIL = 'Test Portal <portal@example.test>'
process.env.RESEND_REPLY_TO_EMAIL = 'replies@example.test'
const { createHarness } = require('./stakeholder-harness.cjs')
let h
const values = { paymentStatus: 'unpaid', paymentMethod: null, status: 'pending', shippingStatus: 'not_scheduled', assignedDriverId: null }
test.before(async () => { h = await createHarness() })
test.after(async () => { await h?.pg.close() })
async function newOrder(extra = {}) {
 const [o] = await h.runtime.db.insert(h.api.schema.orders).values({customerId:h.accountId,createdBy:h.runtime.session.user.id,orderType:'paid',...extra}).returning()
 return o
}
const form = value => { const f = new FormData(); for (const [k,v] of Object.entries(value)) f.set(k,String(v)); return f }
const historical = extra => form({ accountId:h.accountId, id:'',revision:0,orderDate:'2020-03-04',productId:h.productId,productNameFreeform:'',cases:2,bottles:0,orderValue:'180',caseUnitPrice:'90',bottleUnitPrice:'',externalReference:randomUUID(),paymentStatus:'',fulfillmentStatus:'',notes:'synthetic purchase',source:'manual_historical',duplicateReason:'',...extra })

test('migrations preserve historical rows and create the incomplete recipe draft', async () => {
 assert.equal((await h.pg.query("SELECT count(*)::int n FROM tastings WHERE event_name='Historical tasting'")).rows[0].n,1)
 const draft = (await h.pg.query("SELECT * FROM managed_recipes WHERE handle='wisher-autumn-sunrise'")).rows[0]
 assert.equal(draft.status,'draft'); assert.deepEqual(draft.ingredients,[])
})
test('staff saves distinct statuses and changes/removes a real driver; values survive re-read', async () => {
 const previousSession=h.runtime.session
 h.runtime.session={user:{...previousSession.user,role:'staff',roles:['staff']}}
 const o=await newOrder()
 const [driver]=await h.runtime.db.insert(h.api.schema.drivers).values({userId:h.rachelId,phone:'+12025550123'}).returning()
 const next={...values,paymentMethod:'check',paymentStatus:'paid',status:'confirmed',shippingStatus:'scheduled',assignedDriverId:driver.id}
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:values,next})).success,true)
 const saved=(await h.pg.query('SELECT * FROM orders WHERE id=$1',[o.id])).rows[0]
 assert.equal(saved.payment_method,'check'); assert.equal(saved.payment_status,'paid'); assert.equal(saved.status,'confirmed'); assert.equal(saved.shipping_status,'scheduled'); assert.equal(saved.assigned_driver_id,driver.id)
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:next,next:{...next,assignedDriverId:null}})).success,true)
 assert.equal((await h.pg.query('SELECT count(*)::int n FROM activity_events WHERE entity_id=$1',[o.id])).rows[0].n,2)
 h.runtime.session=previousSession
})
test('stale concurrent writes cannot overwrite a saved operational edit', async () => {
 const o=await newOrder()
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:values,next:{...values,status:'confirmed'}})).success,true)
 const stale=await h.api.saveOrderOperations({orderId:o.id,expected:values,next:{...values,paymentMethod:'cod'}})
 assert.equal(stale.conflict,true)
 assert.equal((await h.pg.query('SELECT status,payment_method FROM orders WHERE id=$1',[o.id])).rows[0].status,'confirmed')
})
test('audit failure rolls back order update; retry is recoverable', async () => {
 const o=await newOrder()
 await h.pg.exec("CREATE FUNCTION reject_operation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outage'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION reject_operation_audit();")
 assert.ok((await h.api.saveOrderOperations({orderId:o.id,expected:values,next:{...values,status:'confirmed'}})).error)
 assert.equal((await h.pg.query('SELECT status FROM orders WHERE id=$1',[o.id])).rows[0].status,'pending')
 await h.pg.exec('DROP TRIGGER reject_audit ON activity_events; DROP FUNCTION reject_operation_audit();')
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:values,next:{...values,status:'confirmed'}})).success,true)
})
test('unauthorized roles and invalid states fail without mutation; Stripe remains provider managed', async () => {
 const o=await newOrder({stripePaymentIntentId:'pi_mock'})
 const current={...values}
 assert.match((await h.api.saveOrderOperations({orderId:o.id,expected:current,next:{...current,paymentStatus:'paid'}})).error,/Stripe/)
 const old=h.runtime.session
 h.runtime.session={user:{id:h.rachelId,role:'customer',roles:['customer']}}
 assert.match((await h.api.saveOrderOperations({orderId:o.id,expected:current,next:{...current,status:'fulfilled'}})).error,/Unauthorized/)
 h.runtime.session=old
 assert.ok((await h.api.saveOrderOperations({orderId:o.id,expected:values,next:{...values,shippingStatus:'bogus'}})).error)
})
test('lost response can be retried idempotently without duplicate audit', async () => {
 const o=await newOrder(), next={...values,paymentMethod:'cod'}
 await h.api.saveOrderOperations({orderId:o.id,expected:values,next})
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:values,next})).success,true)
 assert.equal((await h.pg.query('SELECT count(*)::int n FROM activity_events WHERE entity_id=$1',[o.id])).rows[0].n,1)
})
test('legacy sample shipping saves preserve payment records; status retries queue one notification', async () => {
 const sample=await newOrder({orderType:'sample'})
 const next={...values,shippingStatus:'scheduled'}
 assert.equal((await h.api.saveOrderOperations({orderId:sample.id,expected:values,next})).success,true)
 assert.equal((await h.pg.query('SELECT payment_status FROM orders WHERE id=$1',[sample.id])).rows[0].payment_status,'unpaid')
 const o=await newOrder(), changed={...values,status:'confirmed'}, callbacks=h.runtime.after.length
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:values,next:changed})).success,true)
 assert.equal(h.runtime.after.length,callbacks+1)
 assert.equal((await h.api.saveOrderOperations({orderId:o.id,expected:values,next:changed})).success,true)
 assert.equal(h.runtime.after.length,callbacks+1)
})

test('historical date, unit prices and unknowns persist; duplicate review, correction and void retain provenance', async () => {
 const f=historical({externalReference:'invoice-2020-test'})
 assert.equal((await h.api.addHistoricalOrder(f)).success,true)
 const row=(await h.pg.query("SELECT * FROM historical_orders WHERE external_reference='invoice-2020-test'")).rows[0]
 assert.equal(row.order_date.toISOString().slice(0,10),'2020-03-04');assert.equal(row.case_unit_price,'90.00');assert.equal(row.payment_status,null)
 assert.match((await h.api.addHistoricalOrder(f)).error,/duplicate/i)
 const correction=historical({id:row.id,revision:1,externalReference:'invoice-2020-test',orderValue:'160',caseUnitPrice:'80'})
 assert.equal((await h.api.addHistoricalOrder(correction)).success,true)
 assert.match((await h.api.addHistoricalOrder(correction)).error,/changed elsewhere/i)
 assert.equal((await h.api.deleteHistoricalOrder(row.id,h.accountId)).success,true)
 assert.equal((await h.pg.query('SELECT fulfillment_status FROM historical_orders WHERE id=$1',[row.id])).rows[0].fulfillment_status,'cancelled')
})
test('onboarding request never grants terms; only admin approval with history changes terms', async () => {
 const f=form({accountId:h.accountId,revision:0,referralContactId:'',referringAccountId:'',requestedTerms:'Net 30',status:'pending_terms',whatsappPhone:'+12025550123',whatsappStatus:'follow_up_needed',notes:'Synthetic onboarding only'})
 assert.equal((await h.api.saveAccountOnboarding({},f)).success,true)
 assert.equal((await h.pg.query('SELECT payment_terms FROM customer_accounts WHERE id=$1',[h.accountId])).rows[0].payment_terms,'PREPAID')
 const old=h.runtime.session
 h.runtime.session={user:{...old.user,role:'staff',roles:['staff']}}
 assert.ok((await h.api.approveAccountTerms({},form({accountId:h.accountId,terms:'NET30',previousTerms:'PREPAID',reason:'Synthetic test approval'}))).error)
 h.runtime.session=old
 assert.equal((await h.api.approveAccountTerms({},form({accountId:h.accountId,terms:'NET30',previousTerms:'PREPAID',reason:'Synthetic test approval'}))).success,true)
 assert.equal((await h.pg.query("SELECT count(*)::int n FROM activity_events WHERE kind='payment_terms_approved'")).rows[0].n,1)
})
test('contact email exposes sender, persists correct account history, and rejects duplicate sends', async () => {
 const [contact]=await h.runtime.db.insert(h.api.schema.contacts).values({customerId:h.accountId,name:'Synthetic contact',email:'recipient@example.test'}).returning()
 const id=randomUUID(), calls=h.runtime.emailCalls??0
 assert.equal((await h.api.sendQuickEmail(contact.email,contact.name,'Synthetic subject','<script>example</script>',id,contact.id)).success,true)
 assert.equal((await h.api.sendQuickEmail(contact.email,contact.name,'Synthetic subject','<script>example</script>',id,contact.id)).success,true)
 assert.equal(h.runtime.emailCalls,calls+1)
 const row=(await h.pg.query('SELECT * FROM contact_emails WHERE id=$1',[id])).rows[0]
 assert.equal(row.account_id,h.accountId);assert.equal(row.status,'accepted');assert.equal(row.reply_to,'replies@example.test')
 assert.match(h.runtime.lastEmail.message.html,/&lt;script&gt;/)
 assert.equal(h.runtime.lastEmail.options.idempotencyKey,`contact-email/${id}`)
})
test('returned provider errors and uncertain transport outcomes never claim success or delivery', async () => {
 h.runtime.providerResult={data:null,error:{message:'mock rejected'}}
 assert.match((await h.api.sendQuickEmail('test@example.test','Test','subject','body',randomUUID())).error,/mock rejected/)
 h.runtime.providerResult=null;h.runtime.providerThrows=true
 const id=randomUUID()
 assert.match((await h.api.sendQuickEmail('test@example.test','Test','subject','body',id)).error,/unconfirmed/)
 assert.equal((await h.pg.query('SELECT status FROM contact_emails WHERE id=$1',[id])).rows[0].status,'unknown')
 const calls=h.runtime.emailCalls
 await h.api.sendQuickEmail('test@example.test','Test','subject','body',id)
 assert.equal(h.runtime.emailCalls,calls)
 h.runtime.providerThrows=false
 assert.ok((await h.api.sendQuickEmail('invalid','Test','subject','body',randomUUID())).error)
})

test('saved drafts remain drafts, sending claims them once and records the final content', async () => {
 const [contact]=await h.runtime.db.insert(h.api.schema.contacts).values({customerId:h.accountId,name:'Draft contact',email:'draft@example.test'}).returning()
 const id=randomUUID(), calls=h.runtime.emailCalls
 assert.equal((await h.api.saveContactEmailDraft(contact.id,id,'Draft subject','Draft body')).success,true)
 assert.equal(h.runtime.emailCalls,calls)
 assert.equal((await h.pg.query('SELECT status FROM contact_emails WHERE id=$1',[id])).rows[0].status,'draft')
 assert.equal((await h.api.sendQuickEmail(contact.email,contact.name,'Final subject','Final body',id,contact.id)).success,true)
 assert.equal((await h.pg.query('SELECT body FROM contact_emails WHERE id=$1',[id])).rows[0].body,'Final body')
 await h.api.saveContactEmailDraft(contact.id,id,'late draft','must not overwrite')
 assert.equal((await h.pg.query('SELECT body FROM contact_emails WHERE id=$1',[id])).rows[0].body,'Final body')
})
test('reconciled historical purchases feed lifetime history and shared account economics', async () => {
 const f=historical({orderDate:'2018-04-05',externalReference:'old-synthetic-1',orderValue:'120',caseUnitPrice:'60'})
 assert.equal((await h.api.addHistoricalOrder(f)).success,true)
 const summary=await h.api.getLifetimeOrderSummary(h.accountId)
 assert.equal(summary.firstOrderDate.toISOString().slice(0,10),'2018-04-05')
 assert.ok(summary.history.some(p=>p.source==='Historical purchase' && p.total===120))
 const intelligence=await h.api.loadAccountIntelligence(h.accountId,{mode:'admin',accountIds:null,canSeeAllAccounts:true,salesMemberId:null,visibleSalesMemberIds:null,viewerLabel:'Test'})
 assert.ok(intelligence.orders.some(o=>o.status==='historical' && o.total===120 && o.cases===2))
 assert.equal(intelligence.row.velocity.organicPercent,null)
})

test('delivery events are idempotent, timestamped and survive callbacks before send acknowledgement', async () => {
 const id=randomUUID()
 await h.runtime.db.insert(h.api.schema.contactEmails).values({id,actorUserId:h.runtime.session.user.id,sender:'test@example.test',recipient:'test@example.test',subject:'Synthetic',body:'Synthetic',status:'queued'})
 const event={id:'event-1',type:'email.delivered',at:'2026-10-27T15:00:00Z',providerMessageId:'mock-early',communicationId:id}
 await h.api.recordContactEmailEvent(event);await h.api.recordContactEmailEvent(event)
 let row=(await h.pg.query('SELECT * FROM contact_emails WHERE id=$1',[id])).rows[0]
 assert.equal(row.status,'delivered');assert.equal(row.delivery_events.length,1);assert.equal(row.delivery_events[0].at,event.at)
 await h.api.recordContactEmailEvent({...event,id:'event-2',type:'email.bounced'})
 await h.api.recordContactEmailEvent({...event,id:'event-3'})
 row=(await h.pg.query('SELECT * FROM contact_emails WHERE id=$1',[id])).rows[0]
 assert.equal(row.status,'failed');assert.equal(row.delivery_events.length,3)
})
