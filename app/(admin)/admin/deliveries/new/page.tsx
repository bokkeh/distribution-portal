import { db } from '@/db'
import { drivers, users, orders, customerAccounts } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
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

  const openOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
      contactName: customerAccounts.contactName,
      pocName: customerAccounts.pocName,
      pocPhone: customerAccounts.pocPhone,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .where(inArray(orders.status, ['pending', 'confirmed']))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Delivery</h1>
          <p className="text-muted-foreground mt-1">Pick a delivery date, assign a driver, and add open orders to the route</p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Delivery Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createDelivery} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weekStartDate">Delivery Date</Label>
              <Input type="date" name="weekStartDate" id="weekStartDate" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverId">Assign Driver</Label>
              <select
                name="driverId"
                id="driverId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select driver...</option>
                {activeDrivers.map(driver => (
                  <option key={driver.id} value={driver.id}>{driver.name} ({driver.phone})</option>
                ))}
              </select>
            </div>

            {openOrders.length > 0 ? (
              <div className="space-y-3">
                <Label>Add Open Orders to Route</Label>
                <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                  {openOrders.map(order => (
                    <label key={order.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" name="orderIds" value={order.id} className="mt-1 rounded" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{order.companyName}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Order #{order.id.slice(0, 8)} • {[order.address, order.city, order.state, order.zip].filter(Boolean).join(', ')} • ${order.total}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Account contact: {order.pocName || order.contactName || 'Not provided'}
                          {order.pocPhone ? ` • ${order.pocPhone}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open orders are available to add to a delivery route.</p>
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
