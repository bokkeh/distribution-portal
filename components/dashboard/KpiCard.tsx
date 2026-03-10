import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  iconColor?: string
}

export default function KpiCard({ title, value, change, changeType = 'neutral', icon: Icon, iconColor = 'text-blue-600' }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && (
              <p className={cn('text-xs mt-1', {
                'text-green-600': changeType === 'positive',
                'text-red-600': changeType === 'negative',
                'text-muted-foreground': changeType === 'neutral',
              })}>
                {change}
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-xl bg-slate-100', iconColor)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
