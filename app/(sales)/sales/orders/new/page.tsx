import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts, inventory, products, salesMembers } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import OrderFormClient from '@/components/orders/OrderFormClient'
import { getPricingRulesForProducts } from '@/lib/pricing/geographic-service'

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>
}) {
  const { customer } = await searchParams
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : [])
  const canManageAny = roles.includes('admin') || roles.includes('sales_manager')

  let salesMemberId: string | null = null
  if (!canManageAny) {
    const [member] = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member) {
      throw new Error('No sales member profile found.')
    }

    salesMemberId = member.id
  }

  const [customers, productList] = await Promise.all([
    canManageAny
      ? db
          .select({
            id: customerAccounts.id,
            companyName: customerAccounts.companyName,
            businessType: customerAccounts.businessType,
            paymentTerms: customerAccounts.paymentTerms,
            state: customerAccounts.state,
            county: customerAccounts.county,
          })
          .from(customerAccounts)
          .orderBy(customerAccounts.companyName)
      : db
          .select({
            id: customerAccounts.id,
            companyName: customerAccounts.companyName,
            businessType: customerAccounts.businessType,
            paymentTerms: customerAccounts.paymentTerms,
            state: customerAccounts.state,
            county: customerAccounts.county,
          })
          .from(customerAccounts)
          .where(eq(customerAccounts.assignedSalesRepId, salesMemberId!))
          .orderBy(customerAccounts.companyName),
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
  const pricingRules = await getPricingRulesForProducts(productList.map((product) => product.id))
  const initialCustomerId = customers.some((account) => account.id === customer) ? customer : undefined

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center gap-4">
        <Link href={initialCustomerId ? `/sales/accounts/${initialCustomerId}` : '/sales/accounts'}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Log Order</h1>
          <p className="mt-1 text-muted-foreground">Capture an order for one of your assigned accounts.</p>
        </div>
      </div>
      <OrderFormClient
        customers={customers}
        products={productList}
        pricingRules={pricingRules}
        mode="sales"
        initialCustomerId={initialCustomerId}
      />
    </div>
  )
}
