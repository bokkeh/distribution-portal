'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PinToggleButton({
  pinned,
  onToggle,
  theme = 'light',
}: {
  pinned: boolean
  onToggle: () => void
  theme?: 'light' | 'dark'
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className={cn(
        'ml-1 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
        pinned && 'opacity-100',
        theme === 'dark'
          ? pinned ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
          : pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500',
      )}
      aria-label={pinned ? 'Unpin from favorites' : 'Pin to favorites'}
      title={pinned ? 'Unpin from favorites' : 'Pin to favorites'}
    >
      <Star className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
    </button>
  )
}
