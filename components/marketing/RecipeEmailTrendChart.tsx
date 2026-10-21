'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type RecipeEmailTrendPoint = {
  week: string // e.g. "Oct 19"
  sent: number
  unsubscribed: number
  complaints: number
  bounced: number
}

const axisTick = { fontSize: 11, fill: '#94a3b8' }
const tooltipStyle = { borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }

const LOSS_SERIES = [
  { key: 'unsubscribed', label: 'Unsubscribed', color: '#64748b' },
  { key: 'complaints', label: 'Marked as spam', color: '#ef4444' },
  { key: 'bounced', label: 'Bounced', color: '#f59e0b' },
] as const

/** Sends and lost subscribers sit on very different scales, so they get separate panels instead of a dual axis. */
export function RecipeEmailTrendChart({ data }: { data: RecipeEmailTrendPoint[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Emails sent per week</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Sent']} contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="sent" fill="#ff5a00" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Subscribers lost per week</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(value, name) => [Number(value).toLocaleString(), LOSS_SERIES.find((series) => series.key === name)?.label ?? name]}
              contentStyle={tooltipStyle}
              cursor={{ fill: '#f8fafc' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => LOSS_SERIES.find((series) => series.key === value)?.label ?? value} />
            {LOSS_SERIES.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                stackId="lost"
                fill={series.color}
                maxBarSize={36}
                radius={index === LOSS_SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
