'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type RecipeEngagementTrendPoint = { week: string; openRate: number | null; clickRate: number | null; engagementRate: number | null }
const series = [{ key: 'openRate', label: 'Open rate', color: '#ff5a00' }, { key: 'clickRate', label: 'Click-through rate', color: '#0284c7' }, { key: 'engagementRate', label: 'Engagement rate', color: '#16a34a' }]

export function RecipeEmailEngagementChart({ data }: { data: RecipeEngagementTrendPoint[] }) {
  if (!data.some(row => row.engagementRate !== null)) return <p className="text-sm text-slate-500">Engagement trends will appear after the next tracked send. Older sends were not tracked.</p>
  return <div role="img" aria-label="Weekly open, click-through and engagement rates" className="h-64 min-w-0">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
      <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} />
      <Tooltip formatter={(value, name) => [value === null ? 'Not tracked' : `${Number(value).toFixed(1)}%`, series.find(row => row.key === name)?.label ?? name]} />
      <Legend wrapperStyle={{ fontSize: 12 }} formatter={value => series.find(row => row.key === value)?.label ?? value} />
      {series.map(row => <Line key={row.key} type="linear" dataKey={row.key} stroke={row.color} strokeWidth={2} connectNulls={false} dot={{ r: 3 }} />)}
    </LineChart></ResponsiveContainer>
  </div>
}

