import { cn } from '@/lib/utils'

type ProgressTone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const barTone: Record<ProgressTone, string> = {
  accent: 'bg-[#ff5a00]',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-[#3b82f6]',
  neutral: 'bg-slate-500',
}

const valueTone: Record<ProgressTone, string> = {
  accent: 'text-[#ff5a00]',
  success: 'text-green-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  info: 'text-[#2563eb]',
  neutral: 'text-slate-700',
}

export function Progress({
  value,
  max = 100,
  label,
  helper,
  tone = 'accent',
  className,
}: {
  value: number
  max?: number
  label: string
  helper?: string
  tone?: ProgressTone
  className?: string
}) {
  const safeMax = max > 0 ? max : 100
  const safeValue = Math.min(Math.max(value, 0), safeMax)
  const percent = (safeValue / safeMax) * 100

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="ui-eyebrow text-slate-700">{label}</p>
          {helper ? <p className="mt-0.5 truncate text-xs text-slate-500">{helper}</p> : null}
        </div>
        <p className={cn('ui-operational-data shrink-0 text-sm', valueTone[tone])}>
          {Math.round(percent)} <span className="text-slate-400">/ 100</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', barTone[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
