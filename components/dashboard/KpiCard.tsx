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
    <Card className="border-0 bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-6 text-4xl font-bold tracking-tight text-slate-950">{value}</p>
            {change && (
              <p className={cn('mt-2 text-sm font-medium', {
                'text-green-600': changeType === 'positive',
                'text-red-600': changeType === 'negative',
                'text-muted-foreground': changeType === 'neutral',
              })}>
                {change}
              </p>
            )}
          </div>
          <div className={cn('rounded-xl bg-slate-100 p-3', iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
