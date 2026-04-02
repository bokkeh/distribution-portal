'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  const router = useRouter()
  const activeTab = tabs.find((tab) => tab.id === currentTab) ?? tabs[0]

  return (
    <div className="w-full space-y-3">
      <div className="md:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            CRM Sections
          </p>
          <Select
            value={activeTab?.id}
            onValueChange={(value) => {
              const nextTab = tabs.find((tab) => tab.id === value)
              if (nextTab) router.push(nextTab.href, { scroll: false })
            }}
          >
            <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-slate-50 text-sm font-medium text-slate-900">
              <SelectValue placeholder="Choose a section" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden w-full overflow-x-auto md:block">
        <div
          className="grid min-w-0 w-full gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
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
    </div>
  )
}
