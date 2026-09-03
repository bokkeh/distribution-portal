import { updateOrderPaymentType } from '@/actions/orders'
import { Button } from '@/components/ui/button'
import { getOrderPaymentType } from '@/lib/orders/status'

export function OrderPaymentTypeForm({
  orderId,
  paymentStatus,
  paymentMethod,
  stripeManaged,
}: {
  orderId: string
  paymentStatus: string
  paymentMethod: string | null
  stripeManaged: boolean
}) {
  if (stripeManaged) {
    return <p className="text-xs text-muted-foreground">Stripe controls this order’s payment status automatically.</p>
  }

  return (
    <form action={updateOrderPaymentType} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor={`payment-type-${orderId}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update payment type</label>
      <div className="flex gap-2">
        <select
          id={`payment-type-${orderId}`}
          name="paymentType"
          defaultValue={getOrderPaymentType(paymentStatus, paymentMethod)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="unpaid">Unpaid</option>
          <option value="check">Check</option>
          <option value="cod">COD</option>
          <option value="paid">Paid — manually confirmed</option>
        </select>
        <Button type="submit" size="sm">Save</Button>
      </div>
      <p className="text-xs text-slate-500">Only mark Paid after funds have been received.</p>
    </form>
  )
}
