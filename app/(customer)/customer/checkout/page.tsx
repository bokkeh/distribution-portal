import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import CheckoutClient from '@/components/cart/CheckoutClient'

export default async function CheckoutPage() {
  const session = await requireRole('customer')

  const [account] = await db
    .select({ id: customerAccounts.id, businessType: customerAccounts.businessType })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
        <p className="text-muted-foreground mt-1">Complete your order</p>
      </div>
      <CheckoutClient customerId={account?.id ?? ''} customerName={session.user.name ?? ''} businessType={account?.businessType} />
    </div>
  )
}
