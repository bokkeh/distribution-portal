'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function TasterSignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex items-center gap-2 text-slate-400 hover:text-white"
    >
      <LogOut className="h-4 w-4" />Sign Out
    </button>
  )
}
