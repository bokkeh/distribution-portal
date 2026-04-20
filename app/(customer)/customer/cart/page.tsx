import CustomerCartPage from '@/components/cart/CustomerCartPage'
import { db } from '@/db'
import { customerAccounts, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { getPricingRulesForProducts, normalizeAccountGeography } from '@/lib/pricing/geographic-service'

export default async function CartPage() {
  const session = await requireRole('customer')
  const [account] = await db
    .select({ id: customerAccounts.id, businessType: customerAccounts.businessType, state: customerAccounts.state, county: customerAccounts.county })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))
    .limit(1)
  const productList = await db.select({ id: products.id, price: products.price }).from(products).where(eq(products.active, true))
  const pricingRules = await getPricingRulesForProducts(productList.map((product) => product.id))
  const pricingContext = normalizeAccountGeography({
    accountId: account?.id,
    businessType: account?.businessType,
    state: account?.state,
    county: account?.county,
  })

  return (
    <CustomerCartPage
      businessType={account?.businessType}
      pricingRules={pricingRules}
      pricingAccountId={pricingContext.accountId}
      pricingBusinessType={pricingContext.businessType}
      pricingState={pricingContext.state}
      pricingCounty={pricingContext.county}
    />
  )
}
