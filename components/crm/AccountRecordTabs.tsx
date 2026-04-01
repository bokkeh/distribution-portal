'use client'

import Link from 'next/link'

type Tab = {
  id: string
  label: string
  href: string
}

export function AccountRecordTabs({
  tabs,
  currentTab,
}: {
  tabs: Tab[]
  currentTab: string
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div
        className="flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm md:grid md:min-w-0 md:w-full"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = tab.id === currentTab
          return (
            <Link
              key={tab.id}
              href={tab.href}
              scroll={false}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-center text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
