'use client'

import { usePathname } from 'next/navigation'
import { CallProvider } from '@/lib/call/CallContext'
import { CallDrawer } from './CallDrawer'

export function CallShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDisclosurePage = ['/privacy', '/terms', '/sms-consent/taster'].includes(pathname)
  return (
    <CallProvider>
      {children}
      {!isDisclosurePage && <CallDrawer />}
    </CallProvider>
  )
}
