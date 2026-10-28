import assert from 'node:assert/strict'
import test from 'node:test'
import { groupHistoricalPurchases, reconcileHistoricalPurchases, type HistoricalPurchaseLine } from './history-reconciliation'
const line = (extra: Partial<HistoricalPurchaseLine> = {}): HistoricalPurchaseLine => ({id:'h1',accountId:'a1',orderDate:new Date('2020-02-03T12:00:00Z'),productId:'p1',productNameFreeform:null,cases:'1',bottles:'0',orderValue:'100',externalReference:null,fulfillmentStatus:null,bottlesPerCase:6,...extra})
test('exact manual/import/live overlap is reconciled without mutating records',()=>{
 const rows=[line(),line({id:'h2'})]
 const result=reconcileHistoricalPurchases(rows,[])
 assert.equal(result.included.length,1);assert.equal(result.excluded.length,1)
 const live=reconcileHistoricalPurchases(rows,[{accountId:'a1',orderId:'live',date:'2020-02-03',productId:'p1',cases:1,bottles:0,value:100}])
 assert.equal(live.included.length,0);assert.equal(rows.length,2)
})
test('different product, date, amount or account is not discarded as a duplicate',()=>{
 const rows=[line(),line({id:'2',productId:'p2'}),line({id:'3',accountId:'a2'}),line({id:'4',orderValue:'90'})]
 assert.equal(reconcileHistoricalPurchases(rows,[]).included.length,4)
})
test('shared references group multi-SKU purchases, convert six-pack bottles, and preserve unknown revenue',()=>{
 const grouped=groupHistoricalPurchases([line({externalReference:'invoice1'}),line({id:'2',productId:'p2',externalReference:'invoice1',cases:'0',bottles:'6',orderValue:null})])
 assert.equal(grouped.length,1);assert.equal(grouped[0].cases,2);assert.equal(grouped[0].bottles,12);assert.equal(grouped[0].revenueKnown,false)
})
test('voided rows do not feed totals',()=>assert.equal(reconcileHistoricalPurchases([line({fulfillmentStatus:'cancelled'})],[]).included.length,0))

test('staff-confirmed separate purchases remain in metrics despite a matching natural signature',()=>{
 const result=reconcileHistoricalPurchases([line(),line({id:'separate',externalReference:'another-invoice',duplicateReviewReason:'Verified separate purchase in source ledger'})],[])
 assert.equal(result.included.length,2)
})
