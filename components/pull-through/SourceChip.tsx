import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { fmtShortDate } from '@/lib/pull-through/display'
import type { SourceRef } from '@/lib/pull-through/types'

/**
 * Shows where a number came from. Rendered next to any figure a user might want to
 * question, so an incorrect value can be traced to the record that produced it.
 */
export function SourceChip({ source, className = '' }: { source: SourceRef | null; className?: string }) {
  if (!source) return null

  const who = source.byName ? ` by ${source.byName}` : ''
  const when = source.at ? fmtShortDate(source.at) : null
  const text = `${source.label}${when ? ` · ${when}` : ''}${who}`

  if (!source.href) {
    return <span className={`text-[11px] text-slate-400 ${className}`}>{text}</span>
  }

  return (
    <Link
      href={source.href}
      className={`inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline ${className}`}
    >
      {text}
      <ExternalLink className="h-2.5 w-2.5" />
    </Link>
  )
}
