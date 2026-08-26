'use client'

import Image from 'next/image'
import Link from 'next/link'
import { LogOut, Settings } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'

export function PortalProfileMenu({
  userName,
  userAvatarUrl,
  profileHref,
  canSwitchViews = false,
}: {
  userName?: string | null
  userAvatarUrl?: string | null
  profileHref?: string | null
  canSwitchViews?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedName = userName?.trim() || 'User'
  const handle = resolvedName.toUpperCase().replace(/\s+/g, '_')
  const initials = resolvedName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 items-center gap-2.5 rounded-lg bg-white/95 px-1.5 py-1 text-slate-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a00] focus-visible:ring-offset-2"
        aria-label={`Open ${resolvedName} profile menu`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white font-mono text-xs font-bold text-orange-600">
          {userAvatarUrl ? (
            <Image src={userAvatarUrl} alt="" fill className="object-cover" sizes="36px" unoptimized />
          ) : initials}
        </span>
        <span className="hidden max-w-40 truncate font-mono text-xs font-bold uppercase tracking-[0.08em] text-slate-700 sm:block">
          {handle}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Profile and portal controls"
          className="absolute right-0 z-[80] mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-visible rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-orange-600">
              {userAvatarUrl ? (
                <Image src={userAvatarUrl} alt="" fill className="object-cover" sizes="40px" unoptimized />
              ) : initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{resolvedName}</p>
              <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{handle}</p>
            </div>
          </div>

          {profileHref ? (
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              Settings
            </Link>
          ) : null}

          {canSwitchViews ? (
            <div className="mt-1 border-t border-slate-100 pt-2">
              <SuperAdminViewSwitcher compact embedded />
            </div>
          ) : null}

          <div className="mt-1 border-t border-slate-100 pt-1">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <LogOut className="h-4 w-4 text-slate-400" />
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
