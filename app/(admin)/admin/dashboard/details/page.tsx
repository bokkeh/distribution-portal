import { ACCOUNT_REVENUE_DEFINITION, getReportDateRange, accountRevenueFilter } from '@/lib/dashboard/reporting'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, inventory, orders, products } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { formatCurrency } from '@/lib/utils'
import { CustomerRecordLink } from '@/components/crm/CustomerRecordLink'
import { Card, CardContent } from '@/components/ui/card'

export default async function DashboardDetails({ searchParams }: {
  searchParams: Promise<{ view?: string; from?: string; to?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const view = params.view
  if (view !== 'orders' && view !== 'revenue' && view !== 'stock') notFound()
  const { fromInput: from, toInput: to, fromDate, toDate } = getReportDateRange(params.from, params.to)
  const range = new URLSearchParams()
  if (from) range.set('from', from)
  if (to) range.set('to', to)
  const filters = view === 'revenue' ? accountRevenueFilter(fromDate, toDate) : and(
    fromDate ? gte(orders.createdAt, fromDate) : undefined,
    toDate ? lte(orders.createdAt, toDate) : undefined,
  )
  const accounts = view === 'stock' ? [] : await db.select({
    id: customerAccounts.id,
    name: customerAccounts.companyName,
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
  }).from(orders)
    .innerJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .where(filters)
    .groupBy(customerAccounts.id, customerAccounts.companyName)
    .orderBy(desc(view === 'orders' ? sql`COUNT(*)` : sql`COALESCE(SUM(${orders.total}), 0)`), customerAccounts.companyName, customerAccounts.id)
  const stock = view !== 'stock' ? [] : await db.select({
    id: products.id, name: products.name, sku: products.sku,
    quantity: inventory.quantityPaid, reorderLevel: inventory.reorderLevel,
  }).from(inventory).innerJoin(products, eq(inventory.productId, products.id))
    .where(lte(inventory.quantityPaid, inventory.reorderLevel)).orderBy(products.name)
  const title = view === 'orders' ? 'Total Orders by Account' : view === 'revenue' ? 'Top Accounts by Revenue' : 'Low Stock Items'

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <Link href={`/admin/dashboard${range.size ? `?${range}` : ''}`} className="text-sm text-primary hover:underline">← Back to dashboard</Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-muted-foreground">{view === 'stock'
          ? `${stock.length} warehouse products at or below their reorder level. Current inventory snapshot.`
          : `${accounts.length} accounts · ${from || to ? `${from ?? 'Beginning'} through ${to ?? 'today'}` : 'All time'}${view === 'revenue' ? ' · Cancelled orders excluded' : ' · All order statuses included'}`}</p>
        {view === 'revenue' ? <p className="mt-2 text-sm text-muted-foreground">{ACCOUNT_REVENUE_DEFINITION} Reporting dates use Eastern Time.</p> : null}
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        {view === 'stock' ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr><th className="p-4">Product</th><th className="p-4">SKU</th><th className="p-4 text-right">Cases left</th><th className="p-4 text-right">Reorder level</th></tr></thead>
            <tbody className="divide-y">{stock.map(item => <tr key={item.id}><td className="p-4"><Link href={`/admin/inventory/${item.id}`} className="text-primary hover:underline">{item.name}</Link></td><td className="p-4">{item.sku}</td><td className="p-4 text-right">{item.quantity}</td><td className="p-4 text-right">{item.reorderLevel}</td></tr>)}</tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr><th className="p-4">Rank</th><th className="p-4">Account</th><th className="p-4 text-right">Orders</th><th className="p-4 text-right">{view === 'revenue' ? 'Revenue' : 'Order total'}</th></tr></thead>
            <tbody className="divide-y">{accounts.map((account, index) => <tr key={account.id}><td className="p-4">{index + 1}</td><td className="p-4"><CustomerRecordLink accountId={account.id} name={account.name} /></td><td className="p-4 text-right">{account.count}</td><td className="p-4 text-right font-semibold">{formatCurrency(account.total)}</td></tr>)}</tbody>
          </table>
        )}
        {(view === 'stock' ? stock.length : accounts.length) === 0 && <p className="p-8 text-center text-muted-foreground">{view === 'stock' ? 'No low stock items.' : 'No orders in this date range.'}</p>}
      </CardContent></Card>
    </div>
  )
}
