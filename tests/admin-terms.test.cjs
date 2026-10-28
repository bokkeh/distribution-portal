/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict')
const {createHarness}=require('./admin-terms-harness.cjs')
let h
const form=values=>{const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,String(v));return f}
test.before(async()=>{h=await createHarness()});test.after(async()=>{await h?.pg.close()})
test('requested Net 30 does not approve credit and competing onboarding saves do not overwrite',async()=>{
 const data={accountId:h.accountId,revision:0,referralContactId:'',referringAccountId:'',requestedTerms:'Net 30',status:'pending_terms',whatsappPhone:'',whatsappStatus:'not_started',notes:'Synthetic approval regression'}
 assert.equal((await h.api.saveAccountOnboarding({},form(data))).success,true)
 assert.ok((await h.api.saveAccountOnboarding({},form(data))).error)
 assert.equal((await h.pg.query('SELECT payment_terms FROM customer_accounts WHERE id=$1',[h.accountId])).rows[0].payment_terms,'PREPAID')
})
test('staff cannot approve; admin approval is audited and stale updates are rejected',async()=>{
 const original=h.runtime.session
 const data={accountId:h.accountId,terms:'NET30',previousTerms:'PREPAID',reason:'Synthetic explicit admin approval'}
 h.runtime.session={user:{...original.user,role:'staff',roles:['staff']}}
 assert.ok((await h.api.approveAccountTerms({},form(data))).error)
 h.runtime.session=original
 assert.equal((await h.api.approveAccountTerms({},form(data))).success,true)
 assert.ok((await h.api.approveAccountTerms({},form({...data,terms:'NET15'}))).error)
 const row=(await h.pg.query("SELECT a.payment_terms,e.actor_user_id,e.metadata FROM customer_accounts a JOIN activity_events e ON e.entity_id=a.id WHERE a.id=$1 AND e.kind='payment_terms_approved'",[h.accountId])).rows[0]
 assert.equal(row.payment_terms,'NET30');assert.equal(row.actor_user_id,original.user.id);assert.equal(row.metadata.previous,'PREPAID');assert.equal(row.metadata.approved,'NET30')
})
test('admins can adjust terms; invalid terms and missing reasons fail',async()=>{
 const data={accountId:h.accountId,terms:'NET15',previousTerms:'NET30',reason:'Synthetic adjustment approval'}
 assert.ok((await h.api.approveAccountTerms({},form({...data,reason:''}))).error)
 assert.ok((await h.api.approveAccountTerms({},form({...data,terms:'invented'}))).error)
 assert.equal((await h.api.approveAccountTerms({},form(data))).success,true)
 assert.equal((await h.pg.query("SELECT count(*)::int n FROM activity_events WHERE entity_id=$1 AND kind='payment_terms_approved'",[h.accountId])).rows[0].n,2)
})
