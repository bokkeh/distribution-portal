import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, CheckCircle, Clock, XCircle } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { deliveries, drivers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getStopsForDelivery, hasPhoto } from '@/lib/driver/deliveries'
import SortableStopList from '@/components/deliveries/SortableStopList'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function DriverDeliveryDetailPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>
}) {
  const { deliveryId } = await params
  const session = await requireRole('driver', 'admin')

  const [delivery] = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      originAddress: deliveries.originAddress,
      driverId: deliveries.driverId,
    })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .limit(1)

  if (!delivery) notFound()

  // For non-admins verify the delivery belongs to this driver
  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin')) {
    const [driver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, session.user.id))
      .limit(1)

    if (!driver || delivery.driverId !== driver.id) redirect('/driver/deliveries')
  }

  const stops = await getStopsForDelivery(deliveryId)
  const deliveredCount = stops.filter((s) => s.status === 'delivered').length
  const failedCount = stops.filter((s) => s.status === 'failed').length
  const pendingCount = stops.filter((s) => s.status === 'pending').length
  const capturedProofCount = stops.filter(hasPhoto).length

  const statusVariant =
    delivery.status === 'completed' ? 'success' :
    delivery.status === 'in_progress' ? 'warning' : 'info'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/driver/deliveries"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to deliveries
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Delivery Run {formatDate(delivery.weekStartDate)}
              </h1>
              <Badge variant={statusVariant} className="capitalize">
                {delivery.status.replace('_', ' ')}
              </Badge>
            </div>
            {delivery.originAddress && (
              <p className="mt-1 text-sm text-slate-500">{delivery.originAddress}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Stops</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{stops.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-500" />Delivered
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">{deliveredCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center justify-center gap-1">
              {failedCount > 0
                ? <XCircle className="h-3 w-3 text-red-400" />
                : <Clock className="h-3 w-3 text-amber-400" />}
              {failedCount > 0 ? 'Failed' : 'Pending'}
            </p>
            <p className={`mt-1 text-lg font-semibold ${failedCount > 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {failedCount > 0 ? failedCount : pendingCount}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center justify-center gap-1">
              <Camera className="h-3 w-3 text-violet-400" />Proof
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{capturedProofCount}/{stops.length}</p>
          </div>
        </div>
      </div>

      <SortableStopList
        deliveryId={deliveryId}
        stops={stops}
        mode="driver"
        originAddress={delivery.originAddress}
      />
    </div>
  )
}
