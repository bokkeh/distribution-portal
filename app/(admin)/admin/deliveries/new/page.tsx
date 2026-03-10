import { db } from '@/db'
import { drivers, users, orders, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createDelivery } from '@/actions/deliveries'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewDeliveryPage() {
  const activeDrivers = await db
    .select({ id: drivers.id, name: users.name, phone: users.phone })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(drivers.active as any)

  const fulfilledOrders = await db
    .select({
      id: orders.id,
      total: orders.total,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .where(eq(orders.status, 'fulfilled'))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Delivery</h1>
          <p className="text-muted-foreground mt-1">Create a new delivery run and assign a driver</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Delivery Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createDelivery} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weekStartDate">Week Start Date (Monday)</Label>
              <Input type="date" name="weekStartDate" id="weekStartDate" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverId">Assign Driver</Label>
              <select name="driverId" id="driverId" required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select driver...</option>
                {activeDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                ))}
              </select>
            </div>

            {fulfilledOrders.length > 0 && (
              <div className="space-y-3">
                <Label>Add Orders to Route (select all that apply)</Label>
                <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                  {fulfilledOrders.map(order => (
                    <label key={order.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" name="orderIds" value={order.id} className="rounded" />
                      <div>
                        <p className="text-sm font-medium">{order.companyName}</p>
                        <p className="text-xs text-muted-foreground">
                          {[order.address, order.city, order.state].filter(Boolean).join(', ')} — ${order.total}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit">Create & Notify Driver</Button>
              <Link href="/admin/deliveries"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
