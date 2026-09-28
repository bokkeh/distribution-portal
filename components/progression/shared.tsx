import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { RequirementStatus } from '@/lib/progression/eligibility'
import type { EligibilityStatus } from '@/lib/progression/eligibility'
import { Check, Circle, Clock, ShieldAlert, ShieldCheck } from 'lucide-react'

/** Wisher Vodka celestial navy-and-gold accent, scoped to this feature only. */
export const WISHER_NAVY = '#0b1c3a'
export const WISHER_GOLD = '#c9a34e'

export function RankBadge({ level, name, size = 'md' }: { level: number; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg',
  }
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm', sizes[size])}
        style={{ background: `linear-gradient(135deg, ${WISHER_NAVY}, #16305c)`, border: `1.5px solid ${WISHER_GOLD}` }}
      >
        {level}
      </div>
      <div className="min-w-0">
        <p className={cn('font-semibold text-slate-900 leading-tight', size === 'lg' ? 'text-lg' : 'text-sm')}>{name}</p>
        <p className="text-xs uppercase tracking-wide text-slate-400">Level {level}</p>
      </div>
    </div>
  )
}

export function CareerStagePill({ stage }: { stage: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: 'rgba(201,163,78,0.12)', color: '#8a6d1f', border: '1px solid rgba(201,163,78,0.35)' }}
    >
      {stage}
    </span>
  )
}

const ELIGIBILITY_LABEL: Record<EligibilityStatus, string> = {
  not_yet_eligible: 'Not Yet Eligible',
  eligible_for_review: 'Eligible for Review',
  approved_for_promotion: 'Approved for Promotion',
}

const ELIGIBILITY_TONE: Record<EligibilityStatus, string> = {
  not_yet_eligible: 'bg-slate-100 text-slate-500 border-slate-200',
  eligible_for_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved_for_promotion: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  return <Badge variant="outline" className={cn('text-xs font-medium', ELIGIBILITY_TONE[status])}>{ELIGIBILITY_LABEL[status]}</Badge>
}

const STATUS_META: Record<RequirementStatus, { icon: typeof Check; label: string; tone: string }> = {
  complete: { icon: Check, label: 'Complete', tone: 'text-emerald-600' },
  overridden: { icon: ShieldCheck, label: 'Overridden', tone: 'text-violet-600' },
  in_progress: { icon: Clock, label: 'In progress', tone: 'text-amber-600' },
  needs_manager_review: { icon: ShieldAlert, label: 'Needs manager review', tone: 'text-blue-600' },
  not_started: { icon: Circle, label: 'Not started', tone: 'text-slate-400' },
}

export function RequirementStatusIcon({ status, className }: { status: RequirementStatus; className?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return <Icon className={cn('h-4 w-4 shrink-0', meta.tone, className)} />
}

export function requirementStatusLabel(status: RequirementStatus) {
  return STATUS_META[status].label
}

export function requirementStatusTone(status: RequirementStatus) {
  return STATUS_META[status].tone
}

export function StatTile({ label, value, sublabel, href }: { label: string; value: string | number; sublabel?: string; href?: string }) {
  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export function initials(name: string) {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name} className={cn('shrink-0 rounded-full object-cover', dims)} />
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', dims)} style={{ background: WISHER_NAVY }}>
      {initials(name)}
    </div>
  )
}

export function formatPercent(value: number | null) {
  if (value == null) return '—'
  return `${Math.round(value)}%`
}

export function formatNumber(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

export function formatDate(value: Date | string | null) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
