import { db } from '@/db'
import { customerAccounts, products, inventory } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OrderFormClient from '@/components/orders/OrderFormClient'

export default async function NewOrderPage() {
  const [customers, productList] = await Promise.all([
    db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts).orderBy(customerAccounts.companyName),
    db.select({
      id: products.id, sku: products.sku, name: products.name, price: products.price, samplePrice: products.samplePrice,
      brand: products.brand, category: products.category,
      quantityPaid: inventory.quantityPaid, quantitySample: inventory.quantitySample,
    }).from(products)
      .leftJoin(inventory, eq(products.id, inventory.productId))
      .where(products.active as any)
      .orderBy(products.name),
  ])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/staff/orders"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Order</h1>
          <p className="text-muted-foreground mt-1">Place a paid or sample case order</p>
        </div>
      </div>
      <OrderFormClient customers={customers} products={productList} />
    </div>
  )
}
