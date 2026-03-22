'use client'

import { CallProvider } from '@/lib/call/CallContext'
import { CallDrawer } from './CallDrawer'

export function CallShell({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      {children}
      <CallDrawer />
    </CallProvider>
  )
}
