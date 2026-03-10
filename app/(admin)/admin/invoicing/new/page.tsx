import { db } from '@/db'
import { customerAccounts, orders } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInvoice } from '@/actions/invoices'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewInvoicePage() {
  const customers = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts)
  const fulfilledOrders = await db.select({ id: orders.id, total: orders.total, customerId: orders.customerId })
    .from(orders).where(eq(orders.status, 'fulfilled'))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/invoicing"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Invoice</h1>
          <p className="text-muted-foreground mt-1">Generate a new invoice for a customer</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createInvoice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer</Label>
              <select name="customerId" id="customerId" required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderId">Linked Order (optional)</Label>
              <select name="orderId" id="orderId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">No linked order</option>
                {fulfilledOrders.map(o => <option key={o.id} value={o.id}>Order #{o.id.slice(-8).toUpperCase()} — ${o.total}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input type="number" name="amount" id="amount" step="0.01" min="0" required placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Tax ($)</Label>
                <Input type="number" name="tax" id="tax" step="0.01" min="0" defaultValue="0" placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input type="date" name="dueDate" id="dueDate" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit">Create Invoice</Button>
              <Link href="/admin/invoicing"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
