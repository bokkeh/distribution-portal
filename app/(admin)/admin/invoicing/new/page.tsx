import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, invoices, orders, products } from '@/db/schema'
import { AdminInvoiceCreateForm } from '@/components/invoices/AdminInvoiceCreateForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPricingRulesForProducts } from '@/lib/pricing/geographic-service'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; orderId?: string; customerId?: string }>
}) {
  const query = await searchParams
  const customers = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      businessType: customerAccounts.businessType,
      state: customerAccounts.state,
      county: customerAccounts.county,
    })
    .from(customerAccounts)

  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      price: products.price,
      bottlePrice: products.bottlePrice,
      bottlesPerCase: products.bottlesPerCase,
      defaultUnit: products.unit,
    })
    .from(products)
    .where(eq(products.active, true))

  const pricingRules = await getPricingRulesForProducts(productRows.map((product) => product.id))

  const fulfilledOrders = await db
    .select({ id: orders.id, total: orders.total, customerId: orders.customerId })
    .from(orders)
    .where(eq(orders.status, 'fulfilled'))

  const existingInvoices = await db
    .select({ orderId: invoices.orderId })
    .from(invoices)

  const invoicedOrderIds = new Set(existingInvoices.map((invoice) => invoice.orderId).filter(Boolean))
  const availableOrders = fulfilledOrders.filter((order) => !invoicedOrderIds.has(order.id))
  const initialOrder = query.orderId
    ? availableOrders.find((order) => order.id === query.orderId) ?? null
    : null
  const initialCustomerId = query.customerId ?? initialOrder?.customerId ?? ''

  return (
    <div className="space-y-6 p-4 sm:p-8">
      {query.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.success}</div>
      ) : null}
      {query.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error}</div>
      ) : null}

      <div className="flex items-center gap-4">
        <Link href="/admin/invoicing"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Invoice</h1>
          <p className="mt-1 text-muted-foreground">Generate a new invoice for a customer</p>
        </div>
      </div>

      <Card className="max-w-5xl">
        <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
        <CardContent>
          <AdminInvoiceCreateForm
            initialCustomerId={initialCustomerId}
            initialOrderId={initialOrder?.id ?? ''}
            customers={customers}
            orders={availableOrders.map((order) => ({ ...order, total: String(order.total) }))}
            products={productRows.map((product) => ({
              ...product,
              price: String(product.price),
              bottlePrice: String(product.bottlePrice),
              defaultUnit: product.defaultUnit ?? 'case',
            }))}
            pricingRules={pricingRules.map((rule) => ({
              ...rule,
              casePrice: String(rule.casePrice),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
