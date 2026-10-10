'use client'

import Image from 'next/image'
import { useState } from 'react'
import { toDisplayAvatarUrl } from '@/lib/users/avatar'

export function FieldTasterAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : toDisplayAvatarUrl(avatarUrl)
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'
  return <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-orange-200 bg-orange-50 font-semibold text-orange-800">
    {src ? <Image src={src} alt={`${name} profile photo`} fill sizes="48px" unoptimized className="object-cover" onError={() => setFailed(true)} /> : <span aria-hidden="true">{initials}</span>}
  </span>
}
