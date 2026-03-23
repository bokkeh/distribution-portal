'use client'
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'

interface SparklineProps {
  data: number[]
  color?: string
  /** Show a minimal dot-tooltip on hover */
  showTooltip?: boolean
}

export function Sparkline({ data, color = '#3b82f6', showTooltip = false }: SparklineProps) {
  if (data.length < 2) return null

  const chartData = data.map((v, i) => ({ v, i }))

  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={showTooltip ? { r: 3, strokeWidth: 0 } : false}
        />
        {showTooltip && (
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                  {payload[0].value}
                </span>
              ) : null
            }
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
