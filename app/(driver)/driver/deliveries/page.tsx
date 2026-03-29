import { CalendarDays, Camera, History, MapPinned, Route, Truck } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import DeliveryMapWrapper from '@/components/deliveries/DeliveryMapWrapper'
import SortableStopList from '@/components/deliveries/SortableStopList'
import { buildGoogleCalendarUrl } from '@/lib/calendar'
import { getDriverWorkspaceData } from '@/lib/driver/deliveries'
import { formatDate } from '@/lib/utils'

export default async function DriverDeliveriesPage() {
  const session = await requireRole('driver', 'admin')
  const workspace = await getDriverWorkspaceData(session.user.id)

  if (!workspace) {
    return (
      <div className="py-16 text-center">
        <Truck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="text-muted-foreground">No driver profile found. Contact your administrator.</p>
      </div>
    )
  }

  const { driver, deliveryCards, previousDeliveryCards, homeBaseAddress } = workspace

  return (
    <div className="space-y-6">
      <section id="current-deliveries" className="space-y-6">
        {deliveryCards.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <Truck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-700">No deliveries assigned right now.</p>
              <p className="mt-1 text-sm text-slate-500">When dispatch assigns a route, it will appear here with the map, stop list, and proof workflow.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {deliveryCards.map((delivery) => {
              const mapStops = delivery.stops.map((stop) => ({
                id: stop.id,
                lat: parseFloat(stop.lat ?? '0'),
                lng: parseFloat(stop.lng ?? '0'),
                label: String(stop.sequenceNumber),
                title: stop.companyName ?? stop.address,
                address: stop.address,
                contactName: stop.contactName,
                contactPhone: stop.contactPhone,
                status: stop.status,
              }))

              const routeOriginAddress = delivery.originAddress ?? (homeBaseAddress || null)

              return (
                <Card key={delivery.id} className="overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/80">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl text-slate-900">Delivery Run {formatDate(delivery.weekStartDate)}</CardTitle>
                          <Badge variant={delivery.status === 'in_progress' ? 'warning' : 'info'} className="capitalize">
                            {delivery.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Stops</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{delivery.stops.length}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Delivered</p>
                            <p className="mt-1 text-lg font-semibold text-emerald-600">{delivery.deliveredCount}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Pending</p>
                            <p className="mt-1 text-lg font-semibold text-amber-600">{delivery.pendingCount}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Proof captured</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{delivery.capturedProofCount}</p>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                            <span>Route progress</span>
                            <span>{delivery.progress}% complete</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${delivery.failedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${delivery.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={buildGoogleCalendarUrl({
                            title: `AHAWC Delivery Run - ${delivery.weekStartDate}`,
                            details: 'AHAWC driver delivery run',
                            start: new Date(`${delivery.weekStartDate}T08:00:00-05:00`),
                            end: new Date(`${delivery.weekStartDate}T18:00:00-05:00`),
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <CalendarDays className="mr-1.5 h-4 w-4" />
                            Add to Calendar
                          </Button>
                        </a>
                        <a href={`/api/calendar/delivery/${delivery.id}`}>
                          <Button variant="outline" size="sm">Download ICS</Button>
                        </a>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 p-6">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                              <Route className="mt-0.5 h-5 w-5 text-blue-600" />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Next stop</p>
                                <p className="mt-1 text-sm text-slate-700">
                                  {delivery.nextStop ? (delivery.nextStop.companyName ?? delivery.nextStop.address) : 'No pending stops'}
                                </p>
                                {delivery.nextStop ? (
                                  <p className="mt-1 text-xs text-slate-500">{delivery.nextStop.address}</p>
                                ) : (
                                  <p className="mt-1 text-xs text-slate-500">Everything on this run has already been worked.</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                              <Camera className="mt-0.5 h-5 w-5 text-violet-600" />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Proof coverage</p>
                                <p className="mt-1 text-sm text-slate-700">{delivery.capturedProofCount} stop{delivery.capturedProofCount === 1 ? '' : 's'} with photos</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {delivery.deliveredCount > delivery.capturedProofCount
                                    ? `${delivery.deliveredCount - delivery.capturedProofCount} delivered stop${delivery.deliveredCount - delivery.capturedProofCount === 1 ? '' : 's'} still missing photos`
                                    : 'Delivered stops are covered'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Route Map</p>
                              <p className="text-xs text-slate-500">{delivery.mappedCount}/{delivery.stops.length} stops have coordinates</p>
                            </div>
                            {routeOriginAddress ? <p className="max-w-xs truncate text-xs text-slate-500">Start: {routeOriginAddress}</p> : null}
                          </div>
                          <div className="h-[320px] overflow-hidden bg-slate-100 sm:h-[420px]">
                            <DeliveryMapWrapper
                              stops={mapStops}
                              origin={
                                driver.homeLat && driver.homeLng
                                  ? {
                                      lat: parseFloat(driver.homeLat),
                                      lng: parseFloat(driver.homeLng),
                                      title: 'Home Base',
                                      address: homeBaseAddress,
                                    }
                                  : null
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2">
                            <MapPinned className="h-4 w-4 text-slate-400" />
                            <p className="text-sm font-semibold text-slate-900">Stop workflow</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Drag stops into your preferred order, then open directions, upload proof, and mark each stop delivered or failed from the list below.
                          </p>
                        </div>
                        <SortableStopList
                          deliveryId={delivery.id}
                          stops={delivery.stops}
                          mode="driver"
                          originAddress={routeOriginAddress}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Card id="past-deliveries">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                <History className="h-4 w-4 text-slate-400" />
                Previous Deliveries
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Review completed runs, stop counts, and proof coverage from recent delivery history.
              </p>
            </div>
            <Badge variant="outline">{previousDeliveryCards.length} recent run{previousDeliveryCards.length === 1 ? '' : 's'}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {previousDeliveryCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="font-medium text-slate-700">No completed deliveries yet.</p>
              <p className="mt-1 text-sm text-slate-500">Finished runs will appear here once dispatch marks them complete.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {previousDeliveryCards.map((delivery) => {
                const completionRate = delivery.stopCount > 0
                  ? Math.round((delivery.deliveredCount / delivery.stopCount) * 100)
                  : 0

                return (
                  <div key={delivery.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">Delivery Run {formatDate(delivery.weekStartDate)}</p>
                        <p className="mt-1 text-xs text-slate-500">{delivery.originAddress ?? 'No starting location saved'}</p>
                      </div>
                      <Badge variant="success" className="capitalize">completed</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-center">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Stops</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{delivery.stopCount}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-center">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Delivered</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">{delivery.deliveredCount}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-center">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Proof</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{delivery.capturedProofCount}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Completion rate</span>
                        <span>{completionRate}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionRate}%` }} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{delivery.failedCount > 0 ? `${delivery.failedCount} failed stop${delivery.failedCount === 1 ? '' : 's'}` : 'No failed stops'}</span>
                      <span>{delivery.capturedProofCount}/{delivery.stopCount} with photos</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
