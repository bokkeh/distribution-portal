import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sparkline } from './Sparkline'

interface KpiCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  iconColor?: string
  /** Array of numeric values to render as a sparkline trend */
  sparklineData?: number[]
  sparklineColor?: string
}

export default function KpiCard({ title, value, change, changeType = 'neutral', icon: Icon, iconColor = 'text-blue-600', sparklineData, sparklineColor }: KpiCardProps) {
  return (
    <Card className="border-0 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950 truncate">{value}</p>
            {change && (
              <p className={cn('mt-1.5 text-xs font-medium truncate', {
                'text-green-600': changeType === 'positive',
                'text-red-600': changeType === 'negative',
                'text-muted-foreground': changeType === 'neutral',
              })}>
                {change}
              </p>
            )}
          </div>
          <div className={cn('rounded-xl bg-slate-100 p-2.5 shrink-0', iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {sparklineData && sparklineData.length >= 2 && (
          <div className="mt-3 -mx-1 opacity-70">
            <Sparkline data={sparklineData} color={sparklineColor} showTooltip />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
