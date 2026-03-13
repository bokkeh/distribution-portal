import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import Link from 'next/link'
import { ArrowLeft, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react'
import { addDeliveryStop, removeDeliveryStop } from '@/actions/deliveries'

export default async function DeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ deliveryId: string }> | { deliveryId: string }
  searchParams?: Promise<{ addStop?: string; error?: string }> | { addStop?: string; error?: string }
}) {
  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {})
  const showAddStop = resolvedSearchParams.addStop === '1'
  const addStopError = resolvedSearchParams.error

  const [delivery] = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      driverName: users.name,
      driverPhone: users.phone,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(deliveries.id, resolvedParams.deliveryId))

  if (!delivery) notFound()

  const accounts = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
    })
    .from(customerAccounts)
    .orderBy(asc(customerAccounts.companyName))

  let stops: Array<{
    id: string
    sequenceNumber: number
    address: string
    contactName: string | null
    contactPhone: string | null
    contactEmail: string | null
    lat: string | null
    lng: string | null
    status: 'pending' | 'delivered' | 'failed'
    notes: string | null
    completedAt: Date | null
    companyName: string | null
  }> = []

  try {
    stops = await db
      .select({
        id: deliveryStops.id,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        contactName: deliveryStops.contactName,
        contactPhone: deliveryStops.contactPhone,
        contactEmail: deliveryStops.contactEmail,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        status: deliveryStops.status,
        notes: deliveryStops.notes,
        completedAt: deliveryStops.completedAt,
        companyName: customerAccounts.companyName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(eq(deliveryStops.deliveryId, resolvedParams.deliveryId))
      .orderBy(deliveryStops.sequenceNumber)
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
      ?? (error as { cause?: { code?: string } } | null)?.cause?.code
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (code !== '42703' && !message.includes('contact_name') && !message.includes('contact_phone') && !message.includes('contact_email')) {
      throw error
    }

    stops = await db
      .select({
        id: deliveryStops.id,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        status: deliveryStops.status,
        notes: deliveryStops.notes,
        completedAt: deliveryStops.completedAt,
        companyName: customerAccounts.companyName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(eq(deliveryStops.deliveryId, resolvedParams.deliveryId))
      .orderBy(deliveryStops.sequenceNumber)
      .then(rows => rows.map(row => ({
        ...row,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
      })))
  }

  const stopIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-yellow-500" />,
    delivered: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  }

  const mapStops = stops.map(stop => ({
    id: stop.id,
    lat: parseFloat(stop.lat ?? '0'),
    lng: parseFloat(stop.lng ?? '0'),
    label: String(stop.sequenceNumber),
    title: stop.companyName ?? stop.address,
    address: stop.address,
    status: stop.status,
  }))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Delivery Date {formatDate(delivery.weekStartDate)}</h1>
          <p className="text-muted-foreground mt-1">Driver: {delivery.driverName} - {delivery.driverPhone}</p>
        </div>
        <Link href={showAddStop ? `/admin/deliveries/${resolvedParams.deliveryId}` : `/admin/deliveries/${resolvedParams.deliveryId}?addStop=1`}>
          <Button variant="outline">Add Stop</Button>
        </Link>
        <Badge variant={delivery.status === 'completed' ? 'success' : delivery.status === 'in_progress' ? 'warning' : 'info'}>
          {delivery.status.replace('_', ' ')}
        </Badge>
      </div>

      {showAddStop && (
        <Card>
          <CardHeader><CardTitle>Add Stop</CardTitle></CardHeader>
          <CardContent>
            {addStopError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addStopError}
              </div>
            )}
            <form action={addDeliveryStop.bind(null, resolvedParams.deliveryId)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="customerId" className="text-sm font-medium text-slate-900">Select Account</label>
                <select
                  id="customerId"
                  name="customerId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select account...</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.companyName} - {[account.address, account.city, account.state, account.zip].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Button type="submit">Add Stop</Button>
                <Link href={`/admin/deliveries/${resolvedParams.deliveryId}`}>
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Route Map</CardTitle></CardHeader>
          <CardContent className="p-0 h-96 rounded-b-xl overflow-hidden">
            <DeliveryMapWrapper stops={mapStops} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{stops.length} Stops</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stops.map(stop => (
              <div key={stop.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {stop.sequenceNumber}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{stop.companyName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />{stop.address}
                  </p>
                  {(stop.contactName || stop.contactPhone || stop.contactEmail) && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {stop.contactName && <p>POC: {stop.contactName}</p>}
                      {stop.contactPhone && <p>Phone: {stop.contactPhone}</p>}
                      {stop.contactEmail && <p>Email: {stop.contactEmail}</p>}
                    </div>
                  )}
                  {stop.completedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">Completed {formatDate(stop.completedAt)}</p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  {stopIcon[stop.status]}
                  <form action={removeDeliveryStop.bind(null, resolvedParams.deliveryId, stop.id)}>
                    <Button type="submit" variant="outline" size="sm">Remove</Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
