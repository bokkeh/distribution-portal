'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  count?: number
}

interface Props {
  tabs: Tab[]
  children: React.ReactNode[]
}

export function CRMTabs({ tabs, children }: Props) {
  const [active, setActive] = useState(tabs[0].id)
  const activeIndex = tabs.findIndex(t => t.id === active)

  return (
    <div>
      <div className="flex gap-0 border-b mb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              active === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-muted-foreground hover:text-slate-700'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 text-xs bg-slate-100 rounded-full px-2 py-0.5">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      {children[activeIndex]}
    </div>
  )
}
