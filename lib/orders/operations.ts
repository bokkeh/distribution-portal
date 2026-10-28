import { z } from 'zod'

export const operationValues = z.object({
  paymentStatus: z.enum(['not_applicable', 'unpaid', 'requires_action', 'processing', 'paid', 'failed', 'canceled']),
  paymentMethod: z.enum(['stripe', 'check', 'cod', 'manual']).nullable(),
  status: z.enum(['pending', 'confirmed', 'fulfilled', 'cancelled']),
  shippingStatus: z.enum(['not_scheduled', 'scheduled', 'out_for_delivery', 'delivered', 'issue']),
  assignedDriverId: z.string().uuid().nullable(),
})
export const operationInput = z.object({ orderId: z.string().uuid(), expected: operationValues, next: operationValues })
export type OperationValues = z.infer<typeof operationValues>

export function validatePaymentChange(order: { orderType: string; stripePaymentIntentId: string | null }, previous: OperationValues, next: OperationValues) {
  if (order.stripePaymentIntentId && (previous.paymentStatus !== next.paymentStatus || previous.paymentMethod !== next.paymentMethod)) {
    throw new Error('Stripe controls payment for this order.')
  }
  if (previous.paymentStatus === next.paymentStatus && previous.paymentMethod === next.paymentMethod) return
  if (order.orderType === 'sample' && next.paymentStatus !== 'not_applicable') throw new Error('Sample orders do not require payment.')
  if (!order.stripePaymentIntentId && (next.paymentMethod === 'stripe' || ['processing', 'requires_action'].includes(next.paymentStatus))) {
    throw new Error('Stripe payment states require a provider payment intent.')
  }
  if (order.orderType === 'paid' && next.paymentStatus === 'not_applicable') throw new Error('Commercial orders require a payment status.')
}

export const fulfillmentTransitions: Record<OperationValues['status'], readonly OperationValues['status'][]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['fulfilled', 'cancelled'], fulfilled: ['confirmed', 'cancelled'], cancelled: [],
}
export function validateFulfillmentTransition(previous: OperationValues['status'], next: OperationValues['status']) {
  if (previous !== next && !fulfillmentTransitions[previous].includes(next)) throw new Error('This fulfillment transition is not supported. Reload and review the order.')
}
