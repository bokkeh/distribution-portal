'use client'

type DataPoint = {
  label: string
  revenue: number
  projected: boolean
}

export function RevenueTrendChart({ data }: { data: DataPoint[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1)

  const fmt = (n: number) =>
    n >= 1000
      ? `$${(n / 1000).toFixed(0)}k`
      : `$${n.toFixed(0)}`

  return (
    <div className="space-y-2">
      {/* Bar chart */}
      <div className="flex items-end gap-1 h-40">
        {data.map((d, i) => {
          const pct = (d.revenue / max) * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <span className="text-[9px] text-slate-500 font-medium truncate w-full text-center">
                {d.revenue > 0 ? fmt(d.revenue) : ''}
              </span>
              <div
                className={`w-full rounded-t-sm transition-all ${
                  d.projected
                    ? 'bg-blue-200 border-t-2 border-blue-400 border-dashed'
                    : 'bg-blue-500'
                }`}
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={`${d.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(d.revenue)}${d.projected ? ' (projected)' : ''}`}
              />
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex items-start gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className={`text-[9px] font-medium ${d.projected ? 'text-blue-500' : 'text-slate-500'}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-blue-500" />
          Actual
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-blue-200 border border-blue-400 border-dashed" />
          Projected (linear trend)
        </div>
      </div>
    </div>
  )
}
