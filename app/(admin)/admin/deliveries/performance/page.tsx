import { db } from '@/db'
import { deliveries, deliveryStops, drivers, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { and, eq, gte, lte } from 'drizzle-orm'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, User, TrendingUp, CheckCircle2, Camera, Truck } from 'lucide-react'
import { Suspense } from 'react'
import { DateRangeFilter } from '@/components/ui/date-range-filter'

export default async function DriverPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireAdmin()
  const { from, to } = await searchParams

  const dateFilters = [
    from ? gte(deliveries.weekStartDate, from) : undefined,
    to ? lte(deliveries.weekStartDate, to) : undefined,
  ].filter(Boolean) as Parameters<typeof and>

  const allDeliveries = await db
    .select({
      id: deliveries.id,
      status: deliveries.status,
      weekStartDate: deliveries.weekStartDate,
      driverId: deliveries.driverId,
      driverName: users.name,
      driverAvatarUrl: users.avatarUrl,
      vehicleMake: drivers.vehicleMake,
      vehicleModel: drivers.vehicleModel,
      licensePlate: drivers.licensePlate,
      driverActive: drivers.active,
    })
    .from(deliveries)
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(dateFilters.length ? and(...dateFilters) : undefined)

  const allStops = await db
    .select({
      id: deliveryStops.id,
      deliveryId: deliveryStops.deliveryId,
      status: deliveryStops.status,
      proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
      shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
    })
    .from(deliveryStops)

  // Index stops by delivery
  const stopsByDelivery = new Map<string, typeof allStops>()
  for (const stop of allStops) {
    const list = stopsByDelivery.get(stop.deliveryId) ?? []
    list.push(stop)
    stopsByDelivery.set(stop.deliveryId, list)
  }

  // Aggregate by driver
  type DriverStats = {
    driverId: string
    name: string
    avatarUrl: string | null
    vehicleLabel: string | null
    active: boolean
    totalRuns: number
    completedRuns: number
    totalStops: number
    deliveredStops: number
    failedStops: number
    stopsWithProof: number
    stopsWithShelf: number
    recentWeek: string | null
  }

  const byDriver = new Map<string, DriverStats>()

  for (const d of allDeliveries) {
    if (!d.driverId) continue
    const stops = stopsByDelivery.get(d.id) ?? []
    const existing = byDriver.get(d.driverId)
    const vehicleLabel = [d.vehicleMake, d.vehicleModel, d.licensePlate && `(${d.licensePlate})`]
      .filter(Boolean).join(' ') || null

    if (!existing) {
      byDriver.set(d.driverId, {
        driverId: d.driverId,
        name: d.driverName ?? 'Unknown Driver',
        avatarUrl: d.driverAvatarUrl ?? null,
        vehicleLabel,
        active: d.driverActive ?? true,
        totalRuns: 1,
        completedRuns: d.status === 'completed' ? 1 : 0,
        totalStops: stops.length,
        deliveredStops: stops.filter(s => s.status === 'delivered').length,
        failedStops: stops.filter(s => s.status === 'failed').length,
        stopsWithProof: stops.filter(s => s.proofOfDeliveryUrl).length,
        stopsWithShelf: stops.filter(s => s.shelfPhotoUrl).length,
        recentWeek: d.weekStartDate,
      })
    } else {
      existing.totalRuns += 1
      if (d.status === 'completed') existing.completedRuns += 1
      existing.totalStops += stops.length
      existing.deliveredStops += stops.filter(s => s.status === 'delivered').length
      existing.failedStops += stops.filter(s => s.status === 'failed').length
      existing.stopsWithProof += stops.filter(s => s.proofOfDeliveryUrl).length
      existing.stopsWithShelf += stops.filter(s => s.shelfPhotoUrl).length
      if (!existing.recentWeek || d.weekStartDate > existing.recentWeek) {
        existing.recentWeek = d.weekStartDate
      }
    }
  }

  const driverList = Array.from(byDriver.values()).sort((a, b) => {
    // Sort by delivery completion rate desc, then total runs desc
    const rateA = a.totalStops > 0 ? a.deliveredStops / a.totalStops : 0
    const rateB = b.totalStops > 0 ? b.deliveredStops / b.totalStops : 0
    return rateB - rateA || b.totalRuns - a.totalRuns
  })

  // Summary KPIs across all drivers
  const totalRuns = driverList.reduce((s, d) => s + d.totalRuns, 0)
  const totalCompleted = driverList.reduce((s, d) => s + d.completedRuns, 0)
  const totalStops = driverList.reduce((s, d) => s + d.totalStops, 0)
  const totalDelivered = driverList.reduce((s, d) => s + d.deliveredStops, 0)
  const totalProof = driverList.reduce((s, d) => s + d.stopsWithProof, 0)
  const overallCompletion = totalStops > 0 ? ((totalDelivered / totalStops) * 100).toFixed(0) : '0'
  const overallPhotoRate = totalStops > 0 ? ((totalProof / totalStops) * 100).toFixed(0) : '0'

  function pct(num: number, denom: number) {
    if (denom === 0) return '—'
    return `${((num / denom) * 100).toFixed(0)}%`
  }

  function scoreColor(num: number, denom: number) {
    if (denom === 0) return 'text-slate-400'
    const p = (num / denom) * 100
    if (p >= 90) return 'text-emerald-600'
    if (p >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/deliveries">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Driver Performance</h1>
            <p className="mt-1 text-muted-foreground">Completion rates, photo compliance, and activity across all drivers.</p>
          </div>
        </div>
        <Suspense>
          <DateRangeFilter />
        </Suspense>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Runs</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{totalRuns}</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalCompleted} completed</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3"><Truck className="h-5 w-5 text-blue-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stop Completion</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{overallCompletion}%</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalDelivered} of {totalStops} stops delivered</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Photo Compliance</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{overallPhotoRate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalProof} stops with proof photo</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-3"><Camera className="h-5 w-5 text-violet-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Drivers</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{driverList.filter(d => d.active).length}</p>
                <p className="mt-1 text-xs text-muted-foreground">{driverList.length} total drivers</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3"><TrendingUp className="h-5 w-5 text-amber-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {driverList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p>No driver data yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Driver cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {driverList.map((driver, i) => {
              const completionRate = driver.totalStops > 0
                ? ((driver.deliveredStops / driver.totalStops) * 100).toFixed(0)
                : null
              const photoRate = driver.totalStops > 0
                ? ((driver.stopsWithProof / driver.totalStops) * 100).toFixed(0)
                : null
              const avgStops = driver.totalRuns > 0
                ? (driver.totalStops / driver.totalRuns).toFixed(1)
                : null

              return (
                <Card key={driver.driverId} className="overflow-hidden">
                  <CardHeader className="pb-4 border-b bg-slate-50/60">
                    <div className="flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                        {driver.avatarUrl ? (
                          <Image
                            src={driver.avatarUrl}
                            alt={driver.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 truncate">{driver.name}</p>
                          {i === 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                              #1
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {driver.vehicleLabel ?? 'No vehicle info'}
                        </p>
                      </div>
                      <Badge variant={driver.active ? 'success' : 'secondary'} className="text-[10px] shrink-0">
                        {driver.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Runs</p>
                        <p className="text-xl font-bold text-slate-900 mt-0.5">{driver.totalRuns}</p>
                        <p className="text-[10px] text-muted-foreground">{driver.completedRuns} done</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stops</p>
                        <p className="text-xl font-bold text-slate-900 mt-0.5">{driver.totalStops}</p>
                        <p className="text-[10px] text-muted-foreground">{avgStops ?? '—'}/run</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Failed</p>
                        <p className={`text-xl font-bold mt-0.5 ${driver.failedStops > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {driver.failedStops}
                        </p>
                        <p className="text-[10px] text-muted-foreground">stops</p>
                      </div>
                    </div>

                    {/* Completion rate bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Completion rate</span>
                        <span className={`font-semibold ${scoreColor(driver.deliveredStops, driver.totalStops)}`}>
                          {pct(driver.deliveredStops, driver.totalStops)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            driver.totalStops === 0 ? 'bg-slate-200' :
                            (driver.deliveredStops / driver.totalStops) >= 0.9 ? 'bg-emerald-500' :
                            (driver.deliveredStops / driver.totalStops) >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: driver.totalStops > 0 ? `${(driver.deliveredStops / driver.totalStops) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>

                    {/* Photo compliance bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Photo compliance</span>
                        <span className={`font-semibold ${scoreColor(driver.stopsWithProof, driver.totalStops)}`}>
                          {pct(driver.stopsWithProof, driver.totalStops)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            driver.totalStops === 0 ? 'bg-slate-200' :
                            (driver.stopsWithProof / driver.totalStops) >= 0.9 ? 'bg-violet-500' :
                            (driver.stopsWithProof / driver.totalStops) >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: driver.totalStops > 0 ? `${(driver.stopsWithProof / driver.totalStops) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>

                    {driver.recentWeek && (
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Last run: week of {formatDate(driver.recentWeek)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Summary table */}
          <Card>
            <CardHeader><CardTitle className="text-base">All Drivers Summary</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Driver</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Runs</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stops</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivered</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completion</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photo %</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg Stops/Run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverList.map(driver => (
                      <tr key={driver.driverId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-200 shrink-0">
                              {driver.avatarUrl ? (
                                <Image src={driver.avatarUrl} alt={driver.name} fill className="object-cover" unoptimized />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-slate-900">{driver.name}</span>
                            {!driver.active && (
                              <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{driver.totalRuns}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{driver.totalStops}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{driver.deliveredStops}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${scoreColor(driver.deliveredStops, driver.totalStops)}`}>
                            {pct(driver.deliveredStops, driver.totalStops)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${scoreColor(driver.stopsWithProof, driver.totalStops)}`}>
                            {pct(driver.stopsWithProof, driver.totalStops)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {driver.totalRuns > 0 ? (driver.totalStops / driver.totalRuns).toFixed(1) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
