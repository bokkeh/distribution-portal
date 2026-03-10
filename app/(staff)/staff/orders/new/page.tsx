import { db } from '@/db'
import { customerAccounts, products, inventory } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OrderFormClient from '@/components/orders/OrderFormClient'

export default async function NewOrderPage() {
  const [customers, productList] = await Promise.all([
    db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts).orderBy(customerAccounts.companyName),
    db.select({
      id: products.id, sku: products.sku, name: products.name, price: products.price, bottlePrice: products.bottlePrice,
      brand: products.brand, category: products.category,
      bottlesPerCase: products.bottlesPerCase,
      quantityPaid: inventory.quantityPaid, looseBottlePaid: inventory.looseBottlePaid,
    }).from(products)
      .leftJoin(inventory, eq(products.id, inventory.productId))
      .where(eq(products.active, true))
      .orderBy(products.name),
  ])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/staff/orders"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Order</h1>
          <p className="text-muted-foreground mt-1">Place a case or bottle order</p>
        </div>
      </div>
      <OrderFormClient customers={customers} products={productList} />
    </div>
  )
}
