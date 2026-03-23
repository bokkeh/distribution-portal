import { db } from '@/db'
import { products, inventory, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import CustomerProductCatalog from '@/components/products/CustomerProductCatalog'
import { requireRole } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Catalog</Badge>
              {account?.businessType ? <Badge variant="outline" className="capitalize">{account.businessType.replace('_', ' ')}</Badge> : null}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Order Products</h1>
              <p className="mt-1 text-muted-foreground">Browse available inventory, add products to cart, and reorder faster from one catalog view.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Ordering tips</p>
            <p className="mt-2 text-sm text-slate-500">Use search and category filters to narrow the list. Product cards show current stock and any case minimums before you add them to your cart.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/customer/cart"><Button variant="outline">View Cart</Button></Link>
              <Link href="/customer/orders"><Button variant="ghost">Order History</Button></Link>
            </div>
          </div>
        </div>
      </section>
      <CustomerProductCatalog products={productList} categories={categories as string[]} businessType={account?.businessType} />
    </div>
  )
}
