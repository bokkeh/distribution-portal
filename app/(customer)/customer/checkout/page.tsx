import { db } from '@/db'
import { customerAccounts, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import CheckoutClient from '@/components/cart/CheckoutClient'
import { getPricingRulesForProducts, normalizeAccountGeography } from '@/lib/pricing/geographic-service'

export default async function CheckoutPage() {
  const session = await requireRole('customer')

  const [account] = await db
    .select({ id: customerAccounts.id, businessType: customerAccounts.businessType, state: customerAccounts.state, county: customerAccounts.county })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))

  const productList = await db.select({ id: products.id, price: products.price }).from(products).where(eq(products.active, true))
  const pricingRules = await getPricingRulesForProducts(productList.map((product) => product.id))
  const pricingContext = normalizeAccountGeography({
    accountId: account?.id,
    businessType: account?.businessType,
    state: account?.state,
    county: account?.county,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
        <p className="text-muted-foreground mt-1">Complete your order</p>
      </div>
      <CheckoutClient
        customerId={account?.id ?? ''}
        customerName={session.user.name ?? ''}
        pricingRules={pricingRules}
        pricingAccountId={pricingContext.accountId}
        pricingBusinessType={pricingContext.businessType}
        pricingState={pricingContext.state}
        pricingCounty={pricingContext.county}
      />
    </div>
  )
}
