import CustomerCartPage from '@/components/cart/CustomerCartPage'
import { db } from '@/db'
import { customerAccounts, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { getPricingRulesForProducts, normalizeAccountGeography, resolveProductCasePrice } from '@/lib/pricing/geographic-service'

export default async function CartPage() {
  const session = await requireRole('customer')
  const [account] = await db
    .select({ businessType: customerAccounts.businessType, state: customerAccounts.state, county: customerAccounts.county })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))
    .limit(1)
  const productList = await db.select({ id: products.id, price: products.price }).from(products).where(eq(products.active, true))
  const pricingRules = await getPricingRulesForProducts(productList.map((product) => product.id))
  const pricingContext = normalizeAccountGeography({ state: account?.state, county: account?.county })
  const casePriceByProductId = Object.fromEntries(
    productList.map((product) => {
      const pricing = resolveProductCasePrice({
        productId: product.id,
        baseCasePrice: product.price,
        account: pricingContext,
        rules: pricingRules,
        asOf: new Date(),
      })

      return [product.id, pricing.price]
    })
  )

  return <CustomerCartPage businessType={account?.businessType} casePriceByProductId={casePriceByProductId} />
}
