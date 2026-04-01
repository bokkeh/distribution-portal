import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation } from 'lucide-react'

function buildFullAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ')
}

function buildDirectionsHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function buildEmbedHref(address: string, lat?: number | null, lng?: number | null) {
  const query = typeof lat === 'number' && typeof lng === 'number' ? `${lat},${lng}` : address
  return `https://maps.google.com/maps?hl=en&q=${encodeURIComponent(query)}&z=14&output=embed`
}

export function AccountMapCard({
  companyName,
  address,
  city,
  state,
  zip,
  lat,
  lng,
  regionName,
}: {
  companyName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  lat?: number | null
  lng?: number | null
  regionName?: string | null
}) {
  const fullAddress = buildFullAddress([address, city, state, zip])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Account Map
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fullAddress ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <iframe
                title={`${companyName} map`}
                src={buildEmbedHref(fullAddress, lat, lng)}
                className="h-[250px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Location</p>
                  <p className="text-sm text-slate-600">{fullAddress}</p>
                </div>
                <a href={buildDirectionsHref(fullAddress)} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Navigation className="h-4 w-4" />
                    Get Directions
                  </Button>
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No account address on file</p>
            <p className="mt-1 text-sm text-slate-500">Add the address in Settings to place this account on the map.</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned Region</p>
          <div className="mt-2">
            {regionName ? <Badge variant="secondary">{regionName}</Badge> : <Badge variant="outline">Unassigned</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
