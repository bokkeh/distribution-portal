'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function DriverSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  )
}
