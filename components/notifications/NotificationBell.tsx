'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { markAllNotificationsRead, markNotificationKindsRead, markNotificationRead } from '@/actions/user-notifications'

export type NotificationItem = {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  imageUrl?: string | null
  readAt: string | Date | null
  createdAt: string | Date
}

export function NotificationBell({
  items,
  unreadCount,
  dark = false,
  topBar = false,
}: {
  items: NotificationItem[]
  unreadCount: number
  dark?: boolean
  topBar?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [itemsOverride, setItemsOverride] = useState<NotificationItem[] | null>(null)
  const [unreadCountOverride, setUnreadCountOverride] = useState<number | null>(null)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null)
  const [retentionCutoff, setRetentionCutoff] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const seenNotificationIdsRef = useRef(new Set(items.map(item => item.id)))
  const audioContextRef = useRef<AudioContext | null>(null)
  const resolvedItems = itemsOverride ?? items
  const resolvedUnreadCount = unreadCountOverride ?? unreadCount

  const visibleItems = useMemo(() => {
    if (retentionCutoff === null) {
      return resolvedItems
    }

    return resolvedItems.filter((item) => new Date(item.createdAt).getTime() >= retentionCutoff || !item.readAt)
  }, [resolvedItems, retentionCutoff])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, NotificationItem[]>()
    for (const item of visibleItems) {
      const key =
        item.kind.includes('sms') ? 'Inbox' :
        item.kind.includes('delivery') ? 'Deliveries' :
        item.kind.includes('tasting') ? 'Tastings' :
        item.kind.includes('order') || item.kind.includes('shipping') ? 'Orders' :
        'General'
      const group = groups.get(key) ?? []
      group.push(item)
      groups.set(key, group)
    }
    return Array.from(groups.entries())
  }, [visibleItems])

  const classes = useMemo(() => {
    if (topBar) {
      return {
        button: 'relative flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white p-0 text-slate-950 shadow-sm transition hover:bg-slate-100',
        panel: 'fixed z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl',
        item: 'block rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-slate-200',
        title: 'text-sm font-semibold text-slate-900',
        body: 'mt-1 text-xs text-slate-600',
        meta: 'mt-2 text-[11px] text-slate-500',
        empty: 'px-4 py-8 text-center text-sm text-slate-500',
      }
    }

    if (dark) {
      return {
        button: 'relative rounded-xl px-2 py-2 text-slate-200 hover:bg-slate-800/70 hover:text-white',
        panel: 'fixed z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl',
        item: 'block rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-slate-200',
        title: 'text-sm font-semibold text-slate-900',
        body: 'mt-1 text-xs text-slate-600',
        meta: 'mt-2 text-[11px] text-slate-500',
        empty: 'px-4 py-8 text-center text-sm text-slate-500',
      }
    }

    return {
      button: 'relative rounded-xl px-2 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      panel: 'fixed z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl',
      item: 'block rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-slate-200',
      title: 'text-sm font-semibold text-slate-900',
      body: 'mt-1 text-xs text-slate-600',
      meta: 'mt-2 text-[11px] text-slate-500',
      empty: 'px-4 py-8 text-center text-sm text-slate-500',
    }
  }, [dark, topBar])

  useEffect(() => {
    for (const item of items) {
      seenNotificationIdsRef.current.add(item.id)
    }
  }, [items])

  useEffect(() => {
    const refreshRetentionCutoff = () => {
      setRetentionCutoff(Date.now() - 14 * 24 * 60 * 60 * 1000)
    }

    refreshRetentionCutoff()
    const intervalId = window.setInterval(refreshRetentionCutoff, 60 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => null)
    }
  }, [])

  function playNotificationCue() {
    if (typeof window === 'undefined') return

    if ('vibrate' in navigator) {
      navigator.vibrate?.(120)
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) return

      const context = audioContextRef.current ?? new AudioContextCtor()
      audioContextRef.current = context

      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.03, context.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.24)
    } catch {
      // Ignore browsers that block synthetic audio cues.
    }
  }

  function showSystemNotification(item: NotificationItem) {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    try {
      const notification = new Notification(item.title, {
        body: item.body.length > 120 ? `${item.body.slice(0, 117)}...` : item.body,
        tag: item.id,
      })

      if (item.href) {
        notification.onclick = () => {
          window.focus()
          window.location.href = item.href as string
        }
      }
    } catch {
      // Ignore Notification API failures.
    }
  }

  useEffect(() => {
    let cancelled = false

    async function refreshNotifications() {
      if (document.hidden) return

      try {
        const response = await fetch('/api/notifications/bell', { cache: 'no-store' })
        if (!response.ok) return

        const nextData = await response.json() as {
          notifications: NotificationItem[]
          unreadCount: number
        }

        if (cancelled) return

        const newUnreadItems = nextData.notifications.filter(
          item => !item.readAt && !seenNotificationIdsRef.current.has(item.id)
        )

        setItemsOverride(nextData.notifications)
        setUnreadCountOverride(nextData.unreadCount)

        for (const item of nextData.notifications) {
          seenNotificationIdsRef.current.add(item.id)
        }

        if (newUnreadItems.length > 0) {
          playNotificationCue()
        }

        for (const item of newUnreadItems.slice(0, 3)) {
          toast(item.title, {
            description: item.body.length > 120 ? `${item.body.slice(0, 117)}...` : item.body,
          })
          showSystemNotification(item)
        }
      } catch {
        // Keep the bell quiet if polling fails.
      }
    }

    const interval = window.setInterval(refreshNotifications, 30000)
    window.addEventListener('focus', refreshNotifications)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshNotifications)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    function updatePanelPosition() {
      const button = buttonRef.current
      if (!button) return

      const rect = button.getBoundingClientRect()
      const gutter = 12
      const maxWidth = 352
      const width = Math.min(maxWidth, Math.max(280, window.innerWidth - gutter * 2))
      const left = Math.min(
        Math.max(gutter, rect.right - width),
        window.innerWidth - width - gutter
      )
      const top = Math.min(rect.bottom + 12, window.innerHeight - 120)

      setPanelStyle({ top, left, width })
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open])

  function formatTime(value: string | Date) {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
      setItemsOverride(prev => (prev ?? items).map(item => ({ ...item, readAt: item.readAt ?? new Date() })))
      setUnreadCountOverride(0)
    })
  }

  function handleMarkSection(groupItems: NotificationItem[]) {
    const kinds = Array.from(new Set(groupItems.map((item) => item.kind)))
    startTransition(async () => {
      await markNotificationKindsRead(kinds)
      setItemsOverride((prev) =>
        (prev ?? items).map((item) =>
          kinds.includes(item.kind) && !item.readAt ? { ...item, readAt: new Date() } : item
        )
      )
      const unreadInGroup = groupItems.filter((item) => !item.readAt).length
      setUnreadCountOverride((prev) => Math.max(0, (prev ?? unreadCount) - unreadInGroup))
    })
  }

  function handleOpenNotification(notificationId: string) {
    startTransition(async () => {
      const existing = resolvedItems.find(item => item.id === notificationId)
      await markNotificationRead(notificationId)
      setItemsOverride(prev => (prev ?? items).map(item => item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date() } : item))
      if (existing && !existing.readAt) {
        setUnreadCountOverride(prev => Math.max(0, (prev ?? unreadCount) - 1))
      }
    })
  }

  function getItemClasses(href: string | null) {
    return `${classes.item} w-full ${href ? 'cursor-pointer' : ''}`
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={classes.button}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4 fill-current" />
        {resolvedUnreadCount > 0 ? (
          <span className={`absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${topBar ? 'bg-[#ff5a00]' : 'bg-red-600'}`}>
            {resolvedUnreadCount > 9 ? '9+' : resolvedUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className={classes.panel}
            style={panelStyle ? { top: panelStyle.top, left: panelStyle.left, width: panelStyle.width, maxWidth: `calc(100vw - 24px)` } : undefined}
          >
            <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
              <div>
                <p className={dark ? 'text-sm font-semibold text-slate-900' : 'text-sm font-semibold text-slate-900'}>Notifications</p>
                <p className={dark ? 'text-xs text-slate-500' : 'text-xs text-slate-500'}>{resolvedUnreadCount} unread</p>
              </div>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isPending || resolvedUnreadCount === 0}
                className={dark ? 'text-xs text-slate-600 hover:text-slate-900 disabled:text-slate-300' : 'text-xs text-slate-600 hover:text-slate-900 disabled:text-slate-300'}
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4">
              {groupedItems.length ? groupedItems.map(([groupName, groupItems]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className={dark ? 'text-xs font-semibold uppercase tracking-wide text-slate-500' : 'text-xs font-semibold uppercase tracking-wide text-slate-500'}>
                      {groupName}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleMarkSection(groupItems)}
                      className={dark ? 'text-[11px] text-slate-500 hover:text-slate-900' : 'text-[11px] text-slate-500 hover:text-slate-900'}
                    >
                      Mark section read
                    </button>
                  </div>
                  {groupItems.map(item => {
                    if (item.href) {
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={getItemClasses(item.href)}
                          onClick={() => {
                            handleOpenNotification(item.id)
                            setOpen(false)
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                          <p className={classes.title}>{item.title}</p>
                          {!item.readAt ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" /> : null}
                        </div>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="mt-2 h-28 w-full rounded-lg object-cover"
                          />
                        ) : null}
                        <p className={classes.body}>{item.body}</p>
                        {item.href ? <p className="mt-2 text-[11px] font-medium text-blue-500">Open</p> : null}
                        <p className={classes.meta}>{formatTime(item.createdAt)}</p>
                        </Link>
                      )
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={getItemClasses(item.href)}
                        onClick={() => handleOpenNotification(item.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className={classes.title}>{item.title}</p>
                          {!item.readAt ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" /> : null}
                        </div>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="mt-2 h-28 w-full rounded-lg object-cover"
                          />
                        ) : null}
                        <p className={classes.body}>{item.body}</p>
                        <p className={classes.meta}>{formatTime(item.createdAt)}</p>
                      </button>
                    )
                  })}
                </div>
              )) : (
                <div className={classes.empty}>No notifications yet.</div>
              )}
            </div>
          </div>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close notifications" />
        </>
      ) : null}
    </div>
  )
}
