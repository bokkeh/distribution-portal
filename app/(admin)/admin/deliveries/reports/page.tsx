import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users, customerAccounts, shelfAnalyses } from '@/db/schema'
import { eq, desc, inArray, and } from 'drizzle-orm'
import { requireAdmin } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, MapPin, Camera, User, Truck, TriangleAlert } from 'lucide-react'
import { ShelfInsightsCard } from '@/components/deliveries/ShelfInsightsCard'
import { DeliveryPhotoGallery } from '@/components/deliveries/DeliveryPhotoGallery'
import { SignaturePreviewDialog } from '@/components/deliveries/SignaturePreviewDialog'
import type { SerializedShelfAnalysis } from '@/components/deliveries/ShelfInsightsCard'
import { getDeliveryStopAdditionalPhotos } from '@/lib/deliveries/photos'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import { CustomerRecordLink } from '@/components/crm/CustomerRecordLink'

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(ms: number): string {
  const totalMins = Math.round(ms / 60000)
  if (totalMins < 60) return `${totalMins}m`
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

export default async function DeliveryReportsPage() {
  await requireAdmin()

  const completedDeliveries = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      createdAt: deliveries.createdAt,
      driverName: users.name,
      driverAvatarUrl: users.avatarUrl,
      vehicleMake: drivers.vehicleMake,
      vehicleModel: drivers.vehicleModel,
      licensePlate: drivers.licensePlate,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(deliveries.status, 'completed'))
    .orderBy(desc(deliveries.createdAt))
    .limit(30)

  if (completedDeliveries.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/deliveries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Reports</h1>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Truck}
              title="No completed deliveries yet"
              description="Completed delivery runs will appear here with route, proof, and photo reporting."
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const deliveryIds = completedDeliveries.map(d => d.id)

  type StopRow = {
    id: string
    deliveryId: string
    sequenceNumber: number
    address: string
    customerId: string | null
    companyName: string | null
    lat: string | null
    lng: string | null
    status: 'pending' | 'delivered' | 'failed'
    completedAt: Date | null
    proofOfDeliveryUrl: string | null
    shelfPhotoUrl: string | null
    additionalPhotoUrl: string | null
    additionalPhotoUrl2: string | null
    additionalPhotoUrl3: string | null
    additionalPhotoUrl4: string | null
    additionalPhotoUrl5: string | null
    recipientSignatureUrl: string | null
    recipientSignedName: string | null
  }

  let allStops: StopRow[]
  try {
    allStops = await db
      .select({
        id: deliveryStops.id,
        deliveryId: deliveryStops.deliveryId,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        customerId: deliveryStops.customerId,
        companyName: customerAccounts.companyName,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        status: deliveryStops.status,
        completedAt: deliveryStops.completedAt,
        proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
        shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
        additionalPhotoUrl: deliveryStops.additionalPhotoUrl,
        additionalPhotoUrl2: deliveryStops.additionalPhotoUrl2,
        additionalPhotoUrl3: deliveryStops.additionalPhotoUrl3,
        additionalPhotoUrl4: deliveryStops.additionalPhotoUrl4,
        additionalPhotoUrl5: deliveryStops.additionalPhotoUrl5,
        recipientSignatureUrl: deliveryStops.recipientSignatureUrl,
        recipientSignedName: deliveryStops.recipientSignedName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(inArray(deliveryStops.deliveryId, deliveryIds))
      .orderBy(deliveryStops.deliveryId, deliveryStops.sequenceNumber)
  } catch {
    allStops = await db
      .select({
        id: deliveryStops.id,
        deliveryId: deliveryStops.deliveryId,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        customerId: deliveryStops.customerId,
        companyName: customerAccounts.companyName,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        status: deliveryStops.status,
        completedAt: deliveryStops.completedAt,
        proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
        shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
        recipientSignatureUrl: deliveryStops.recipientSignatureUrl,
        recipientSignedName: deliveryStops.recipientSignedName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(inArray(deliveryStops.deliveryId, deliveryIds))
      .orderBy(deliveryStops.deliveryId, deliveryStops.sequenceNumber)
      .then(rows => rows.map(row => ({
        ...row,
        additionalPhotoUrl: null,
        additionalPhotoUrl2: null,
        additionalPhotoUrl3: null,
        additionalPhotoUrl4: null,
        additionalPhotoUrl5: null,
        recipientSignatureUrl: row.recipientSignatureUrl,
        recipientSignedName: row.recipientSignedName,
      })))
  }

  const stopsByDelivery = new Map<string, typeof allStops>()
  for (const stop of allStops) {
    const list = stopsByDelivery.get(stop.deliveryId) ?? []
    list.push(stop)
    stopsByDelivery.set(stop.deliveryId, list)
  }

  // Fetch existing shelf analyses for stops that have shelf photos
  const shelfStopIds = allStops.filter(s => s.shelfPhotoUrl).map(s => s.id)
  const shelfAnalysesMap = new Map<string, SerializedShelfAnalysis>()
  if (shelfStopIds.length > 0) {
    try {
      const analyses = await db
        .select()
        .from(shelfAnalyses)
        .where(and(inArray(shelfAnalyses.deliveryStopId, shelfStopIds), eq(shelfAnalyses.status, 'complete')))
        .orderBy(desc(shelfAnalyses.createdAt))
      const seen = new Set<string>()
      for (const a of analyses) {
        if (!seen.has(a.deliveryStopId)) {
          seen.add(a.deliveryStopId)
          shelfAnalysesMap.set(a.deliveryStopId, {
            ...a,
            createdAt: a.createdAt.toISOString(),
          } as SerializedShelfAnalysis)
        }
      }
    } catch {
      // shelf_analyses table may not exist yet — silently skip
    }
  }

  const totalStops = allStops.length
  const totalDeliveredStops = allStops.filter(stop => stop.status === 'delivered').length
  const totalFailedStops = allStops.filter(stop => stop.status === 'failed').length
  const deliveredWithProof = allStops.filter(stop => (
    stop.status === 'delivered' && Boolean(stop.proofOfDeliveryUrl || stop.recipientSignatureUrl)
  )).length
  const stopsWithPhotos = allStops.filter(stop => (
    Boolean(stop.proofOfDeliveryUrl || stop.shelfPhotoUrl || getDeliveryStopAdditionalPhotos(stop).length > 0)
  )).length
  const overallCompletion = percentage(totalDeliveredStops, totalStops)
  const overallProofCoverage = percentage(deliveredWithProof, totalDeliveredStops)
  const overallPhotoCoverage = percentage(stopsWithPhotos, totalStops)

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-start gap-3">
          <Link href="/admin/deliveries"><Button variant="ghost" size="icon" aria-label="Back to deliveries"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <p className="ui-eyebrow mb-1">Operations / Delivery intelligence</p>
            <h1 className="text-slate-900">Delivery Reports</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {completedDeliveries.length} completed run{completedDeliveries.length !== 1 ? 's' : ''} · {totalStops} recorded stops
            </p>
          </div>
        </div>
        <Badge variant={totalFailedStops > 0 ? 'warning' : 'success'}>
          {totalFailedStops > 0 ? `${totalFailedStops} exception${totalFailedStops === 1 ? '' : 's'}` : 'All routes operational'}
        </Badge>
      </div>

      <Card className="overflow-hidden border-slate-300">
        <CardHeader className="border-b border-slate-200 bg-slate-950 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-eyebrow">Delivery network</p>
              <CardTitle className="mt-1 text-xl text-white">Operational completion</CardTitle>
            </div>
            <p className="ui-operational-data text-xs text-slate-300">LAST {completedDeliveries.length} COMPLETED RUNS</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[1fr_1.5fr] lg:p-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
            <div className="bg-white p-4">
              <p className="ui-eyebrow">Delivered stops</p>
              <p className="ui-display-xl mt-3 text-slate-950">{totalDeliveredStops}</p>
              <p className="mt-2 text-xs text-slate-500">of {totalStops} route stops</p>
            </div>
            <div className="bg-white p-4">
              <p className="ui-eyebrow">Exceptions</p>
              <p className={totalFailedStops > 0 ? 'ui-display-xl mt-3 text-red-600' : 'ui-display-xl mt-3 text-green-600'}>{totalFailedStops}</p>
              <p className="mt-2 text-xs text-slate-500">failed delivery attempts</p>
            </div>
            <div className="col-span-2 flex items-center gap-3 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              {totalFailedStops > 0 ? <TriangleAlert className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {totalFailedStops > 0 ? 'Review failed stops in the run summaries below.' : 'No failed stops in this reporting window.'}
            </div>
          </div>
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <Progress value={overallCompletion} label="Stop fulfillment" helper={`${totalDeliveredStops} of ${totalStops} delivered`} tone="accent" />
            <Progress value={overallProofCoverage} label="Proof capture" helper={`${deliveredWithProof} delivered stops with proof or signature`} tone="success" />
            <Progress value={overallPhotoCoverage} label="Route photo coverage" helper={`${stopsWithPhotos} stops with captured media`} tone="info" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {completedDeliveries.map(delivery => {
          const stops = stopsByDelivery.get(delivery.id) ?? []
          const completedStops = stops.filter(s => s.completedAt)

          // Duration: earliest → latest completedAt (handle string or Date from DB)
          const toMs = (v: Date | string | null): number | null => {
            if (!v) return null
            const ms = v instanceof Date ? v.getTime() : new Date(v).getTime()
            return isNaN(ms) ? null : ms
          }
          const timestamps = completedStops
            .map(s => toMs(s.completedAt))
            .filter((t): t is number => t !== null)
            .sort((a, b) => a - b)
          const durationMs = timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : null

          // Mileage: sum haversine between consecutive stops that have coords
          let totalMiles = 0
          const coordStops = stops.filter(s => {
            const lat = parseFloat(s.lat ?? '')
            const lng = parseFloat(s.lng ?? '')
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
          })
          for (let i = 1; i < coordStops.length; i++) {
            totalMiles += haversineMiles(
              parseFloat(coordStops[i - 1].lat!),
              parseFloat(coordStops[i - 1].lng!),
              parseFloat(coordStops[i].lat!),
              parseFloat(coordStops[i].lng!),
            )
          }

          // All photos across all stops
          const photos: { url: string; label: string; stopLabel: string }[] = []
          for (const stop of stops) {
            const name = stop.companyName ?? stop.address
            if (stop.proofOfDeliveryUrl) photos.push({ url: signedPhotoUrl(stop.proofOfDeliveryUrl)!, label: 'Proof', stopLabel: name })
            if (stop.shelfPhotoUrl) photos.push({ url: signedPhotoUrl(stop.shelfPhotoUrl)!, label: 'Shelf', stopLabel: name })
            getDeliveryStopAdditionalPhotos(stop).forEach((url, index) => {
              photos.push({ url: signedPhotoUrl(url)!, label: `Extra ${index + 1}`, stopLabel: name })
            })
          }

          const deliveredCount = stops.filter(s => s.status === 'delivered').length
          const failedCount = stops.filter(s => s.status === 'failed').length
          const proofCount = stops.filter(s => s.status === 'delivered' && (s.proofOfDeliveryUrl || s.recipientSignatureUrl)).length
          const photoStopCount = stops.filter(s => (
            s.proofOfDeliveryUrl || s.shelfPhotoUrl || getDeliveryStopAdditionalPhotos(s).length > 0
          )).length
          const completionRate = percentage(deliveredCount, stops.length)
          const proofRate = percentage(proofCount, deliveredCount)
          const photoRate = percentage(photoStopCount, stops.length)

          return (
            <Card
              key={delivery.id}
              className="overflow-hidden border-slate-300 [contain-intrinsic-size:auto_720px] [content-visibility:auto]"
            >
              <CardHeader className="border-b border-slate-800 bg-slate-950 pb-4 text-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                    {/* Driver */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#ff5a00] bg-slate-800">
                        {delivery.driverAvatarUrl ? (
                          <Image
                            src={delivery.driverAvatarUrl}
                            alt={delivery.driverName ?? 'Driver'}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <User className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{delivery.driverName ?? 'Unknown Driver'}</p>
                        {(delivery.vehicleMake || delivery.licensePlate) && (
                          <p className="truncate text-xs text-slate-400">
                            {[delivery.vehicleMake, delivery.vehicleModel, delivery.licensePlate && `· ${delivery.licensePlate}`].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Route identity */}
                    <div className="border-t border-slate-800 pt-3 text-left sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <Badge variant="success">Completed</Badge>
                      <CardTitle className="mt-1 text-lg text-white">Delivery {formatDate(delivery.weekStartDate)}</CardTitle>
                      <p className="mt-0.5 text-xs text-slate-400">{stops.length} stop{stops.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex shrink-0 items-center gap-3">
                    <Link href={`/admin/deliveries/${delivery.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                  <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Progress value={completionRate} label="Stop completion" helper={`${deliveredCount} delivered${failedCount > 0 ? ` · ${failedCount} failed` : ''}`} tone="accent" />
                    <Progress value={proofRate} label="Proof of delivery" helper={`${proofCount} of ${deliveredCount} delivered stops documented`} tone="success" />
                    <Progress value={photoRate} label="Photo coverage" helper={`${photoStopCount} stops with route media`} tone="info" />
                  </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stops</p>
                    <p className="ui-operational-data mt-2 text-xl text-blue-700">{stops.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {deliveredCount} delivered{failedCount > 0 ? `, ${failedCount} failed` : ''}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Duration</p>
                    <p className="ui-operational-data mt-2 text-xl text-amber-700">
                      {durationMs !== null ? formatDuration(durationMs) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">first to last stop</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Mileage</p>
                    <p className="ui-operational-data mt-2 text-xl text-green-700">
                      {coordStops.length >= 2 ? `${totalMiles.toFixed(1)} mi` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">estimated route distance</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Camera className="w-3 h-3" />Photos</p>
                    <p className="ui-operational-data mt-2 text-xl text-slate-900">{photos.length}</p>
                    <p className="text-xs text-muted-foreground">captured on route</p>
                  </div>
                </div>
                </div>

                {/* Photos */}
                {photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Captured Photos</p>
                    <DeliveryPhotoGallery photos={photos} />
                  </div>
                )}

                {/* Stop list */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Stop Summary</p>
                  <div className="space-y-1.5">
                    {stops.map(stop => (
                      <div key={stop.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {stop.sequenceNumber}
                        </span>
                        <CustomerRecordLink
                          accountId={stop.customerId}
                          name={stop.companyName ?? stop.address}
                          className="flex-1 min-w-0 truncate text-slate-800"
                        />
                        {stop.completedAt && (
                          <span className="text-xs text-muted-foreground shrink-0" suppressHydrationWarning>
                            {new Date(stop.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <Badge
                          variant={stop.status === 'delivered' ? 'success' : stop.status === 'failed' ? 'destructive' : 'secondary'}
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {stop.status}
                        </Badge>
                        {(stop.proofOfDeliveryUrl || stop.shelfPhotoUrl || getDeliveryStopAdditionalPhotos(stop).length > 0) && (
                          <Camera className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        )}
                        {stop.recipientSignatureUrl && (
                          <SignaturePreviewDialog
                            stopLabel={stop.companyName ?? stop.address}
                            signerName={stop.recipientSignedName}
                            signatureUrl={stop.recipientSignatureUrl}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Shelf Insights — one card per stop with a shelf photo */}
                {(() => {
                  const shelfStops = stops.filter(s => s.shelfPhotoUrl)
                  if (shelfStops.length === 0) return null
                  return (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">AI Shelf Analysis</p>
                      <div className="space-y-3">
                        {shelfStops.map(stop => (
                          <div key={stop.id}>
                            {shelfStops.length > 1 && (
                              <p className="mb-1.5 text-xs font-medium text-slate-600">
                                <CustomerRecordLink accountId={stop.customerId} name={stop.companyName ?? stop.address} />
                              </p>
                            )}
                            <ShelfInsightsCard
                              stop={{
                                id: stop.id,
                                shelfPhotoUrl: stop.shelfPhotoUrl,
                                additionalPhotoUrl: stop.additionalPhotoUrl ?? null,
                                companyName: stop.companyName,
                                address: stop.address,
                              }}
                              existingAnalysis={shelfAnalysesMap.get(stop.id) ?? null}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
