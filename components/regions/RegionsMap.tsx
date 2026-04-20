'use client'

import { GoogleMap, InfoWindow, Marker, Polygon, useJsApiLoader } from '@react-google-maps/api'
import { useState, useMemo } from 'react'
import { MapPin, TrendingUp, Wine, Truck, User, ExternalLink, Building2, Send, Loader2, CheckCircle2, Route, X, Plus } from 'lucide-react'
import type { RegionMapData, RegionMapAccount, RegionMapRegion } from '@/actions/regions-map'
import { sendMapAccountSms } from '@/actions/map-contact'
import { addAccountToRoute } from '@/actions/sales-routes'
import { convexHull, expandHull, circlePolygon } from '@/lib/maps/convex-hull'
import { getRegionColor } from '@/lib/maps/region-colors'
import { formatBusinessType } from '@/lib/customers/business-types'
import { RegionAccountsModal } from './RegionAccountsModal'
import { TelnyxCallButton } from './TelnyxCallButton'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const REGION_MAP_RENDER_TIME = Date.now()

const BUSINESS_TYPE_GLYPH: Record<string, string> = {
  // Display values (new dropdown)
  'Liquor Store': 'L',
  'Restaurant': 'R',
  'Restaurant Group': 'R',
  'Hotel': 'H',
  'Hotel Group': 'H',
  'Venue': 'V',
  'Bar': 'B',
  'Night Club': 'N',
  'Grocery Store': 'G',
  'Convenience Store': 'C',
  'Country Club': 'K',
  'Casino': '$',
  'Wholesaler': 'W',
  // Legacy underscore values
  'restaurant': 'R',
  'restaurant_group': 'R',
  'liquor_store': 'L',
  'hotel': 'H',
  'hotel_group': 'H',
  'venue': 'V',
  'bar': 'B',
}

function getAccountMarkerGlyph(account: RegionMapAccount): string {
  if (account.businessType && BUSINESS_TYPE_GLYPH[account.businessType]) {
    return BUSINESS_TYPE_GLYPH[account.businessType]
  }
  // Fall back to account type
  switch (account.accountType) {
    case 'on_premise': return 'R'
    case 'off_premise': return 'L'
    case 'chain': return 'C'
    case 'independent': return 'I'
    default: return 'A'
  }
}

function getAccountMarkerTitle(account: RegionMapAccount): string {
  return formatBusinessType(account.businessType) || account.accountType?.replaceAll('_', ' ') || 'Account'
}

/**
 * Health color based on time-decay since last visit relative to the account's
 * visit frequency. Staleness = daysSinceVisit / visitFrequency.
 *
 *  No rep assigned       → slate  (unmanaged)
 *  Never visited         → red    (no relationship built)
 *  staleness < 0.75      → green  (fresh — well within window)
 *  staleness 0.75–1.0    → lime   (due soon, still in window)
 *  staleness 1.0–1.5     → amber  (overdue up to 50%)
 *  staleness 1.5–2.5     → orange (significantly overdue)
 *  staleness > 2.5       → red    (relationship at risk)
 */
function getAccountHealthColor(account: RegionMapAccount): string {
  if (!account.assignedSalesRepId) return '#64748B' // slate = no rep

  if (!account.lastVisitDate) return '#EF4444' // red = never visited

  const daysSince = (Date.now() - new Date(account.lastVisitDate).getTime()) / 86400000
  const freq = account.visitFrequency ?? 30 // default 30-day cadence
  const staleness = daysSince / freq

  if (staleness < 0.75) return '#22C55E' // green  — fresh
  if (staleness < 1.0)  return '#84CC16' // lime   — due soon
  if (staleness < 1.5)  return '#F59E0B' // amber  — overdue
  if (staleness < 2.5)  return '#F97316' // orange — significantly overdue
  return '#EF4444'                        // red    — relationship at risk
}

function getAccountRegionColor(account: RegionMapAccount, regionColorMap: Map<string, string>): string {
  if (!account.regionId) return '#94A3B8'
  return regionColorMap.get(account.regionId) ?? '#94A3B8'
}

type MyRoute = { id: string; name: string; description: string | null }

export function RegionsMap({ data, routes = [] }: { data: RegionMapData; routes?: MyRoute[] }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null)
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<RegionMapAccount | null>(null)
  const [managingRegion, setManagingRegion] = useState<RegionMapRegion | null>(null)
  const [routePickerAccount, setRoutePickerAccount] = useState<RegionMapAccount | null>(null)
  const [addingToRoute, setAddingToRoute] = useState<string | null>(null) // routeId being added
  const [routeAddResult, setRouteAddResult] = useState<{ routeId: string; ok: boolean } | null>(null)

  // Color index per region
  const regionColorMap = useMemo(() => {
    const m = new Map<string, string>()
    data.regions.forEach((r, i) => m.set(r.id, getRegionColor(i)))
    return m
  }, [data.regions])

  // Padded region shapes — convex hull (3+ pts) or circle (1–2 pts)
  const regionPolygons = useMemo(() => {
    const result = new Map<string, { lat: number; lng: number }[]>()
    for (const region of data.regions) {
      const pts = data.accounts
        .filter(a => a.regionId === region.id && a.lat != null && a.lng != null)
        .map(a => ({ lat: a.lat!, lng: a.lng! }))

      if (pts.length === 0) continue

      if (pts.length === 1) {
        result.set(region.id, circlePolygon(pts[0], 0.018))
      } else if (pts.length === 2) {
        const centre = {
          lat: (pts[0].lat + pts[1].lat) / 2,
          lng: (pts[0].lng + pts[1].lng) / 2,
        }
        result.set(region.id, circlePolygon(centre, 0.018))
      } else {
        result.set(region.id, expandHull(convexHull(pts), 0.014))
      }
    }
    return result
  }, [data.regions, data.accounts])

  // Accounts with coordinates
  const mappedAccounts = useMemo(
    () => data.accounts.filter(a => a.lat != null && a.lng != null),
    [data.accounts],
  )
  const unmappedAccounts = useMemo(
    () => data.accounts.filter(a => a.lat == null || a.lng == null),
    [data.accounts],
  )

  // Map center: average of all mapped accounts or DC default
  const center = useMemo(() => {
    if (mappedAccounts.length === 0) return { lat: 38.9, lng: -77.0 }
    const avgLat = mappedAccounts.reduce((s, a) => s + a.lat!, 0) / mappedAccounts.length
    const avgLng = mappedAccounts.reduce((s, a) => s + a.lng!, 0) / mappedAccounts.length
    return { lat: avgLat, lng: avgLng }
  }, [mappedAccounts])

  if (!isLoaded) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-xl border bg-slate-50">
        <p className="text-sm text-slate-500">Loading map…</p>
      </div>
    )
  }

  async function handleAddToRoute(routeId: string) {
    if (!routePickerAccount) return
    setAddingToRoute(routeId)
    const result = await addAccountToRoute(routeId, routePickerAccount.id)
    setAddingToRoute(null)
    setRouteAddResult({ routeId, ok: result.ok })
    if (result.ok) setTimeout(() => { setRoutePickerAccount(null); setRouteAddResult(null) }, 1500)
  }

  return (
    <div className="relative flex gap-4" style={{ height: '72vh' }}>
      {/* ── Sidebar ── */}
      <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">
          Regions · {data.accounts.length} accounts
        </p>

        {data.regions.map((region, i) => {
          const color = getRegionColor(i)
          const isHovered = hoveredRegionId === region.id
          const isExpanded = expandedRegionId === region.id
          return (
            <div key={region.id}>
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isHovered || isExpanded ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onMouseEnter={() => setHoveredRegionId(region.id)}
                onMouseLeave={() => setHoveredRegionId(null)}
                onClick={() => setExpandedRegionId((current) => current === region.id ? null : region.id)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">
                    {region.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                    {region.stats.accountCount}
                  </span>
                </div>
                <p className="mt-0.5 truncate pl-5 text-xs text-slate-400">
                  {region.assignedRep?.name ?? 'Unassigned'}
                </p>
              </button>

              {/* Expanded stats stay open until another region is selected */}
              {isExpanded && (
                <div
                  className="mx-1 mb-1 rounded-lg border p-2.5 space-y-1.5"
                  style={{ borderColor: color + '44', backgroundColor: color + '0d' }}
                >
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <User className="h-3 w-3 shrink-0" style={{ color }} />
                    <span className="font-medium">Rep:</span>
                    <span>{region.assignedRep?.name ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <TrendingUp className="h-3 w-3 shrink-0" style={{ color }} />
                    <span className="font-medium">Revenue:</span>
                    <span>{fmt(region.stats.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Wine className="h-3 w-3 shrink-0" style={{ color }} />
                    <span className="font-medium">Tastings:</span>
                    <span>{region.stats.tastingCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Truck className="h-3 w-3 shrink-0" style={{ color }} />
                    <span className="font-medium">Deliveries:</span>
                    <span>{region.stats.deliveryCount}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManagingRegion(region)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-white"
                    style={{ borderColor: color + '66', color }}
                  >
                    <Building2 className="h-3 w-3" />
                    Manage Accounts
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned group */}
        {(() => {
          const unassigned = data.accounts.filter(a => !a.regionId)
          if (unassigned.length === 0) return null
          return (
            <button
              type="button"
              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                hoveredRegionId === '__unassigned__' ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
              onMouseEnter={() => setHoveredRegionId('__unassigned__')}
              onMouseLeave={() => setHoveredRegionId(null)}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full bg-slate-300" />
                <span className="flex-1 text-sm font-medium text-slate-500">Unassigned</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                  {unassigned.length}
                </span>
              </div>
            </button>
          )
        })()}

        <div className="mt-auto border-t pt-2 space-y-1">
                    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Dot Color - Region</p>
          {data.regions.map((region, i) => {
            const color = getRegionColor(i)
            return (
              <div key={region.id} className="flex items-center gap-1.5 px-1">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-500 truncate">{region.name}</span>
              </div>
            )
          })}
          {data.accounts.some((account) => !account.regionId) ? (
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-slate-400" />
              <span className="text-xs text-slate-500">Unassigned</span>
            </div>
          ) : null}
<p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Dot Label — Type</p>
          {[['L','Liquor Store'],['R','Restaurant / Group'],['H','Hotel / Group'],['V','Venue'],['B','Bar'],['N','Night Club'],['G','Grocery'],['C','Convenience'],['K','Country Club'],['$','Casino'],['W','Wholesaler'],['A','Other / Unknown']].map(([glyph, label]) => (
            <div key={glyph} className="flex items-center gap-1.5 px-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-400 text-[9px] font-bold text-white shrink-0">{glyph}</span>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
          {unmappedAccounts.length > 0 && (
            <p className="px-1 text-xs text-slate-400 pt-1">
              <MapPin className="inline h-3 w-3 mr-0.5" />
              {unmappedAccounts.length} account{unmappedAccounts.length !== 1 ? 's' : ''} not geocoded
            </p>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 overflow-hidden rounded-xl border">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={11}
          options={{
            gestureHandling: 'greedy',
            draggableCursor: 'grab',
            draggingCursor: 'grabbing',
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
          }}
          onClick={() => { setSelectedAccount(null); setRoutePickerAccount(null) }}
        >
          {/* Region polygons */}
          {data.regions.map((region, i) => {
            const path = regionPolygons.get(region.id)
            if (!path) return null
            const color = getRegionColor(i)
            const isHovered = hoveredRegionId === region.id
            const otherHovered = hoveredRegionId !== null && hoveredRegionId !== region.id && hoveredRegionId !== '__unassigned__'
            return (
              <Polygon
                key={region.id}
                paths={path}
                options={{
                  fillColor: color,
                  fillOpacity: isHovered ? 0.25 : otherHovered ? 0.04 : 0.13,
                  strokeColor: color,
                  strokeOpacity: isHovered ? 1 : otherHovered ? 0.2 : 0.7,
                  strokeWeight: isHovered ? 3 : 2,
                  clickable: false,
                  zIndex: isHovered ? 2 : 1,
                }}
              />
            )
          })}

          {/* Account markers */}
          {mappedAccounts.map(account => {
            const color = getAccountRegionColor(account, regionColorMap)
            const accountRegionId = account.regionId ?? '__unassigned__'
            const isActive = hoveredRegionId === null || hoveredRegionId === accountRegionId
            const isSelected = selectedAccount?.id === account.id || routePickerAccount?.id === account.id
            const glyph = getAccountMarkerGlyph(account)
            const markerTitle = `${account.companyName} (${getAccountMarkerTitle(account)}) — Ctrl+click to add to route`

            return (
              <Marker
                key={account.id}
                position={{ lat: account.lat!, lng: account.lng! }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: color,
                  fillOpacity: isActive ? 1 : 0.45,
                  strokeColor: '#FFFFFF',
                  strokeOpacity: isActive ? 1 : 0.55,
                  strokeWeight: isSelected ? 4 : 2.5,
                  scale: isSelected ? 14 : 12,
                }}
                label={{
                  text: glyph,
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: '700',
                }}
                opacity={isSelected ? 1 : isActive ? 1 : 0.55}
                title={markerTitle}
                zIndex={isSelected ? 10 : isActive ? 2 : 1}
                onClick={(e) => {
                  if ((e.domEvent as MouseEvent)?.ctrlKey || (e.domEvent as MouseEvent)?.metaKey) {
                    setSelectedAccount(null)
                    setRoutePickerAccount(account)
                    setRouteAddResult(null)
                  } else {
                    setRoutePickerAccount(null)
                    setSelectedAccount(account)
                  }
                }}
              />
            )
          })}

          {/* Account InfoWindow */}
          {selectedAccount && selectedAccount.lat != null && selectedAccount.lng != null && (
            <InfoWindow
              position={{ lat: selectedAccount.lat, lng: selectedAccount.lng }}
              onCloseClick={() => setSelectedAccount(null)}
            >
              <AccountInfoCard account={selectedAccount} />
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Route picker panel — Ctrl+click */}
      {routePickerAccount && (
        <div className="absolute top-4 right-4 z-30 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Route className="h-4 w-4 text-slate-300 shrink-0" />
              <p className="text-sm font-semibold text-white truncate">Add to Route</p>
            </div>
            <button type="button" onClick={() => { setRoutePickerAccount(null); setRouteAddResult(null) }} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500 truncate font-medium">{routePickerAccount.companyName}</p>
            {routes.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No active routes available.</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {routes.map(route => {
                  const result = routeAddResult?.routeId === route.id ? routeAddResult : null
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => handleAddToRoute(route.id)}
                      disabled={addingToRoute === route.id || result?.ok === true}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ${
                        result?.ok ? 'bg-green-50 text-green-700' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="truncate font-medium">{route.name}</span>
                      {result?.ok
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        : addingToRoute === route.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                          : <Plus className="h-4 w-4 text-slate-400 shrink-0" />
                      }
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] text-slate-400">Ctrl+click any account to add it to a route.</p>
          </div>
        </div>
      )}

      {/* Account management modal */}
      {managingRegion && (
        <RegionAccountsModal
          region={managingRegion}
          allRegions={data.regions}
          accounts={data.accounts}
          onClose={() => setManagingRegion(null)}
        />
      )}
    </div>
  )
}

function AccountInfoCard({ account }: { account: RegionMapAccount }) {
  const [composing, setComposing] = useState(false)
  const [smsText, setSmsText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [smsError, setSmsError] = useState<string | null>(null)

  const typeLabel: Record<string, string> = {
    on_premise: 'On-Premise',
    off_premise: 'Off-Premise',
    chain: 'Chain',
    independent: 'Independent',
  }
  const priorityColors: Record<string, string> = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#94A3B8',
  }

  async function handleSend() {
    if (!account.phone || !smsText.trim() || sending) return
    setSending(true)
    setSmsError(null)
    const result = await sendMapAccountSms(account.phone, account.companyName, smsText)
    setSending(false)
    if (result.ok) {
      setSent(true)
      setSmsText('')
      setTimeout(() => { setSent(false); setComposing(false) }, 2500)
    } else {
      setSmsError(result.error ?? 'Failed to send')
    }
  }

  return (
    <div className="min-w-[220px] max-w-[260px] space-y-2 p-1 text-sm">
      <div>
        <p className="font-bold text-slate-900">{account.companyName}</p>
        {account.address && (
          <p className="text-xs text-slate-500">
            {account.address}{account.city ? `, ${account.city}` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {account.businessType && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
            {formatBusinessType(account.businessType)}
          </span>
        )}
        {account.accountType && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            {typeLabel[account.accountType] ?? account.accountType}
          </span>
        )}
        {account.accountPriority && (
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: priorityColors[account.accountPriority] ?? '#94A3B8' }}
          >
            {account.accountPriority} priority
          </span>
        )}
      </div>

      {account.phone && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <div className="flex-1">
              <TelnyxCallButton phone={account.phone} accountName={account.companyName} accountId={account.id} />
            </div>
            <button
              type="button"
              onClick={() => { setComposing(c => !c); setSmsError(null) }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              <Send className="h-3 w-3" /> Text
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center">{account.phone}</p>

          {composing && (
            <div className="space-y-1.5">
              <textarea
                value={smsText}
                onChange={e => setSmsText(e.target.value)}
                placeholder="Type your message…"
                rows={3}
                className="w-full resize-none rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {smsError && <p className="text-[10px] text-red-500">{smsError}</p>}
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !smsText.trim() || sent}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sent
                  ? <><CheckCircle2 className="h-3 w-3" /> Sent!</>
                  : sending
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</>
                    : <><Send className="h-3 w-3" /> Send via Telnyx</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-2 text-center text-xs">
        <div>
          <p className="font-semibold text-slate-800">{fmt(account.revenue)}</p>
          <p className="text-slate-400">Revenue</p>
        </div>
        <div>
          <p className="font-semibold text-slate-800">{account.tastingCount}</p>
          <p className="text-slate-400">Tastings</p>
        </div>
        <div>
          <p className="font-semibold text-slate-800">{account.deliveryCount}</p>
          <p className="text-slate-400">Deliveries</p>
        </div>
      </div>

      {/* Visit health bar */}
      {(() => {
        const healthColor = getAccountHealthColor(account)
        const daysSince = account.lastVisitDate
          ? Math.floor((REGION_MAP_RENDER_TIME - new Date(account.lastVisitDate).getTime()) / 86400000)
          : null
        const freq = account.visitFrequency ?? 30
        const staleness = daysSince != null ? daysSince / freq : null
        const daysUntilNext = account.nextRequiredVisitDate
          ? Math.ceil((new Date(account.nextRequiredVisitDate).getTime() - REGION_MAP_RENDER_TIME) / 86400000)
          : null

        return (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              <span>Visit Health</span>
              <span style={{ color: healthColor }} className="font-bold">
                {!account.assignedSalesRepId ? 'No rep' :
                 !account.lastVisitDate ? 'Never visited' :
                 staleness! < 0.75 ? 'Healthy' :
                 staleness! < 1.0 ? 'Due soon' :
                 staleness! < 1.5 ? 'Overdue' :
                 staleness! < 2.5 ? 'At risk' : 'Critical'}
              </span>
            </div>
            {/* Staleness bar */}
            {staleness != null && (
              <div className="relative h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(staleness * 50, 100)}%`,
                    backgroundColor: healthColor,
                  }}
                />
              </div>
            )}
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>
                {account.lastVisitDate
                  ? `Last visit: ${daysSince === 0 ? 'today' : `${daysSince}d ago`}`
                  : 'Never visited'}
              </span>
              {daysUntilNext != null && (
                <span className={daysUntilNext < 0 ? 'text-red-500 font-medium' : daysUntilNext <= 7 ? 'text-amber-600 font-medium' : ''}>
                  {daysUntilNext < 0 ? `${Math.abs(daysUntilNext)}d overdue` : `Next: ${daysUntilNext}d`}
                </span>
              )}
            </div>
          </div>
        )
      })()}

      <a
        href={`/admin/crm/${account.id}`}
        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        View account <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
