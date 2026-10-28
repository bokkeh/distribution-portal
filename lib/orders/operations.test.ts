import assert from 'node:assert/strict'
import test from 'node:test'
import { operationInput, validateFulfillmentTransition, validatePaymentChange, type OperationValues } from './operations'
const v: OperationValues={paymentStatus:'unpaid',paymentMethod:null,status:'pending',shippingStatus:'not_scheduled',assignedDriverId:null}
test('statuses and payment method are independent and runtime validated',()=>{
 assert.equal(operationInput.safeParse({orderId:'10000000-0000-4000-8000-000000000001',expected:v,next:{...v,paymentMethod:'check'}}).success,true)
 assert.equal(operationInput.safeParse({orderId:'x',expected:v,next:{...v,status:'paid'}}).success,false)
 assert.throws(()=>validatePaymentChange({orderType:'paid',stripePaymentIntentId:'pi_test'},v,{...v,paymentStatus:'paid'}),/Stripe/)
 assert.throws(()=>validatePaymentChange({orderType:'sample',stripePaymentIntentId:null},v,{...v,paymentStatus:'paid'}),/Sample/)
})

test('fulfillment retains supported forward, unfulfill and cancellation transitions',()=>{
 assert.doesNotThrow(()=>validateFulfillmentTransition('fulfilled','confirmed'))
 assert.throws(()=>validateFulfillmentTransition('cancelled','fulfilled'))
 assert.throws(()=>validateFulfillmentTransition('pending','fulfilled'))
})

test('legacy payment records permit operational edits while unsupported payment changes are rejected',()=>{
 for (const previous of [v,{...v,paymentMethod:'stripe' as const,paymentStatus:'processing' as const}]) {
  assert.doesNotThrow(()=>validatePaymentChange({orderType:'sample',stripePaymentIntentId:null},previous,{...previous,shippingStatus:'scheduled'}))
  assert.doesNotThrow(()=>validatePaymentChange({orderType:'paid',stripePaymentIntentId:null},previous,{...previous,shippingStatus:'scheduled'}))
 }
 assert.throws(()=>validatePaymentChange({orderType:'paid',stripePaymentIntentId:null},v,{...v,paymentMethod:'stripe'}),/provider/)
})
