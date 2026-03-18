import { db } from '@/db'
import { products, inventory, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import CustomerProductCatalog from '@/components/products/CustomerProductCatalog'
import { requireRole } from '@/lib/auth/session'

export default async function CustomerProductsPage() {
  const session = await requireRole('customer')

  const [productList, [account]] = await Promise.all([
    db
      .select({
        id: products.id, sku: products.sku, name: products.name,
        description: products.description, category: products.category, brand: products.brand,
        price: products.price, samplePrice: products.samplePrice, imageUrl: products.imageUrl,
        quantityPaid: inventory.quantityPaid, quantitySample: inventory.quantitySample,
      })
      .from(products)
      .leftJoin(inventory, eq(products.id, inventory.productId))
      .where(products.active as any)
      .orderBy(products.name),
    db
      .select({ businessType: customerAccounts.businessType })
      .from(customerAccounts)
      .where(eq(customerAccounts.userId, session.user.id))
      .limit(1),
  ])

  const categories = [...new Set(productList.map(p => p.category).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Order Products</h1>
        <p className="text-muted-foreground mt-1">Browse our full catalog and add items to your order</p>
      </div>
      <CustomerProductCatalog products={productList} categories={categories as string[]} businessType={account?.businessType} />
    </div>
  )
}
