import CustomerCartPage from '@/components/cart/CustomerCartPage'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'

export default async function CartPage() {
  const session = await requireRole('customer')
  const [account] = await db
    .select({ businessType: customerAccounts.businessType })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))
    .limit(1)

  return <CustomerCartPage businessType={account?.businessType} />
}
