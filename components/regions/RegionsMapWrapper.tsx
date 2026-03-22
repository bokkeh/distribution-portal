import dynamic from 'next/dynamic'
import type { RegionMapData } from '@/actions/regions-map'

const RegionsMapDynamic = dynamic(
  () => import('./RegionsMap').then(m => ({ default: m.RegionsMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[72vh] items-center justify-center rounded-xl border bg-slate-50">
        <p className="text-sm text-slate-500">Loading map…</p>
      </div>
    ),
  },
)

export function RegionsMapWrapper({ data }: { data: RegionMapData }) {
  return <RegionsMapDynamic data={data} />
}
