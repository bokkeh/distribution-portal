import Link from 'next/link'
import { cn } from '@/lib/utils'

type CustomerRecordPortal = 'admin' | 'staff' | 'sales'

const recordBasePath: Record<CustomerRecordPortal, string> = {
  admin: '/admin/crm',
  staff: '/staff/crm',
  sales: '/sales/accounts',
}

export function CustomerRecordLink({
  accountId,
  name,
  portal = 'admin',
  className,
}: {
  accountId: string | null | undefined
  name: string
  portal?: CustomerRecordPortal
  className?: string
}) {
  if (!accountId) return <span className={className}>{name}</span>

  return (
    <Link
      href={`${recordBasePath[portal]}/${accountId}`}
      className={cn(
        'rounded-sm underline-offset-4 transition-colors hover:text-[#d94300] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f00] focus-visible:ring-offset-2',
        className,
      )}
      title={`Open ${name} customer record`}
    >
      {name}
    </Link>
  )
}
