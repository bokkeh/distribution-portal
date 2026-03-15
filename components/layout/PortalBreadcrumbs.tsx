'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LABELS: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
  driver: 'Driver',
  taster: 'Taster',
  crm: 'CRM',
  inbox: 'SMS Inbox',
  deliveries: 'Deliveries',
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  invoicing: 'Invoicing',
  jobs: 'Jobs',
  system: 'System Health',
  orders: 'Orders',
  tastings: 'Tastings',
  profile: 'Profile',
  users: 'Users',
  'wholesale-requests': 'Wholesaler Requests',
  payouts: 'Payouts',
}

function labelForSegment(segment: string) {
  if (LABELS[segment]) return LABELS[segment]
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return segment.slice(0, 8).toUpperCase()
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function PortalBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`
        const isLast = index === segments.length - 1
        return (
          <div key={href} className="flex items-center gap-2">
            {index > 0 ? <span className="text-slate-300">/</span> : null}
            {isLast ? (
              <span className="font-medium text-slate-900">{labelForSegment(segment)}</span>
            ) : (
              <Link href={href} className="hover:text-slate-900">
                {labelForSegment(segment)}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
