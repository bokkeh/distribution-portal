'use client'

import { useState } from 'react'
import { List, Map } from 'lucide-react'
import type { RegionMapData } from '@/actions/regions-map'
import { RegionsMapWrapper } from '@/components/regions/RegionsMapWrapper'
import { GeocodeButton } from '@/components/regions/GeocodeButton'

type MyRoute = { id: string; name: string; description: string | null }

interface Props {
  mapData: RegionMapData
  listContent: React.ReactNode
  routes?: MyRoute[]
}

export function RegionsViewToggle({ mapData, listContent, routes }: Props) {
  const [view, setView] = useState<'list' | 'map'>('list')
  const missingCount = mapData.accounts.filter(a => a.lat == null || a.lng == null).length

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'list'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'map'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            Map
          </button>
        </div>

        {view === 'map' && <GeocodeButton missingCount={missingCount} />}
      </div>

      {/* Content */}
      {view === 'list' ? listContent : <RegionsMapWrapper data={mapData} routes={routes} />}
    </div>
  )
}
