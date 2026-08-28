'use client'

import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  count?: number
}

interface Props {
  tabs: Tab[]
  children: React.ReactNode[]
  defaultTab?: string
  ariaLabel?: string
}

export function PageTabs({ tabs, children, defaultTab, ariaLabel = 'Page views' }: Props) {
  const resolvedDefaultTab = tabs.some((tab) => tab.id === defaultTab) ? defaultTab! : tabs[0].id
  const [active, setActive] = useState(resolvedDefaultTab)
  const activeIndex = tabs.findIndex(t => t.id === active)
  const activeTab = tabs[activeIndex] ?? tabs[0]

  useEffect(() => {
    setActive(resolvedDefaultTab)
  }, [resolvedDefaultTab])

  return (
    <div>
      {/* Mobile: hamburger menu */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-[#f4f1ed] px-1 py-2 sm:hidden">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-base font-bold uppercase tracking-[0.02em] text-[#181615]"
              aria-label={`Open ${ariaLabel} menu`}
            >
              <Menu className="h-5 w-5 shrink-0" />
              <span className="font-display truncate">{activeTab?.label}</span>
              {activeTab?.count !== undefined && (
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500">{activeTab.count}</span>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={8} className="z-50 w-64 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {tabs.map(tab => (
                <DropdownMenu.Item
                  key={tab.id}
                  onSelect={() => setActive(tab.id)}
                  className={cn(
                    'font-display flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-[0.02em] outline-none transition-colors',
                    active === tab.id ? 'bg-[#f4f1ed] text-[#ff5a00]' : 'text-[#181615] hover:bg-slate-100'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">{tab.count}</span>
                    )}
                  </span>
                  {active === tab.id && <Check className="h-4 w-4 shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Desktop: tab strip */}
      <div role="tablist" aria-label={ariaLabel} className="hidden gap-7 overflow-x-auto border-b border-slate-200 bg-[#f4f1ed] px-1 sm:flex">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'font-display relative whitespace-nowrap px-0 py-4 text-base font-bold uppercase tracking-[0.02em] transition-colors',
              active === tab.id
                ? 'text-[#181615]'
                : 'text-[#817b76] hover:text-[#181615]'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500">{tab.count}</span>
            )}
            {active === tab.id ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] bg-[var(--ahawc-amber)]"
              />
            ) : null}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children[activeIndex]}</div>
    </div>
  )
}
