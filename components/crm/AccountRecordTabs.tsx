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
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const active = tab.id === currentTab
          return (
            <Link
              key={tab.id}
              href={tab.href}
              scroll={false}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
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
