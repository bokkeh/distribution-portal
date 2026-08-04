import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts, inventory, products, salesMembers } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { RepAssistedOrderForm } from '@/components/orders/RepAssistedOrderForm'
import { Button } from '@/components/ui/button'
import { getRepAssistedOrderDetail } from '@/actions/rep-assisted-orders'

export default async function NewRepAssistedOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft: draftId } = await searchParams
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  const canManageAny = roles.includes('admin') || roles.includes('sales_manager')
  const [member] = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
  if (!member && !roles.includes('admin')) throw new Error('No active sales member profile found.')

  const [customers, productList] = await Promise.all([
    db.select({
      id: customerAccounts.id, companyName: customerAccounts.companyName, contactName: customerAccounts.contactName,
      email: customerAccounts.email, phone: customerAccounts.phone, address: customerAccounts.address,
      city: customerAccounts.city, state: customerAccounts.state, zip: customerAccounts.zip,
      paymentTerms: customerAccounts.paymentTerms, hubspotCompanyId: customerAccounts.hubspotCompanyId,
      dcAbraNumber: customerAccounts.dcAbraNumber,
    }).from(customerAccounts)
      .where(canManageAny ? undefined : eq(customerAccounts.assignedSalesRepId, member!.id))
      .orderBy(customerAccounts.companyName),
    db.select({ id: products.id, sku: products.sku, name: products.name, price: products.price, quantityPaid: inventory.quantityPaid })
      .from(products).leftJoin(inventory, eq(products.id, inventory.productId)).where(eq(products.active, true)).orderBy(products.name),
  ])
  const draftDetail = draftId ? await getRepAssistedOrderDetail(draftId) : null
  const saved = (draftDetail?.workflow.draftData ?? {}) as Record<string, unknown>
  const initialDraft = draftDetail ? {
    ...saved,
    idempotencyKey: draftDetail.workflow.idempotencyKey,
    lines: Array.isArray(saved.items) ? saved.items : [],
  } : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><Link href="/sales/orders/assisted"><Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link><div><h1 className="text-2xl font-bold">Create rep-assisted order</h1><p className="text-sm text-muted-foreground">Build an order and invoice, then send a secure review-and-pay link.</p></div></div>
      <RepAssistedOrderForm customers={customers} products={productList} initialDraft={initialDraft} />
    </div>
  )
}
