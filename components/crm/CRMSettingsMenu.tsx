'use client'

import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { GitMerge, Map, Settings, Upload, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const itemClassName = 'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100'

export function CRMSettingsMenu({
  mergeAccountsHref,
  mergePeopleHref,
}: {
  mergeAccountsHref: string
  mergePeopleHref: string
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="CRM tools">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            CRM tools
          </DropdownMenu.Label>
          <DropdownMenu.Item asChild><Link href={mergeAccountsHref} className={itemClassName}><GitMerge className="h-4 w-4" />Merge accounts</Link></DropdownMenu.Item>
          <DropdownMenu.Item asChild><Link href={mergePeopleHref} className={itemClassName}><Users className="h-4 w-4" />Merge people</Link></DropdownMenu.Item>
          <DropdownMenu.Separator className="my-2 h-px bg-slate-100" />
          <DropdownMenu.Item asChild><Link href="/admin/crm/import/wisher" className={itemClassName}><Upload className="h-4 w-4" />Import Wisher CSV</Link></DropdownMenu.Item>
          <DropdownMenu.Item asChild><Link href="/admin/crm/sales-routes" className={itemClassName}><Map className="h-4 w-4" />Sales routes</Link></DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
