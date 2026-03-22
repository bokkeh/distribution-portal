'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { markAllNotificationsRead, markNotificationKindsRead, markNotificationRead } from '@/actions/user-notifications'

type NotificationItem = {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  readAt: string | Date | null
  createdAt: string | Date
}

export function NotificationBell({
  items,
  unreadCount,
  dark = false,
}: {
  items: NotificationItem[]
  unreadCount: number
  dark?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [localItems, setLocalItems] = useState(items)
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadCount)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const seenNotificationIdsRef = useRef(new Set(items.map(item => item.id)))

  const visibleItems = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    return localItems.filter((item) => new Date(item.createdAt).getTime() >= cutoff || !item.readAt)
  }, [localItems])

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
      button: 'relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:border-slate-300 hover:text-slate-900',
      panel: 'fixed z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl',
      item: 'block rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-slate-200',
      title: 'text-sm font-semibold text-slate-900',
      body: 'mt-1 text-xs text-slate-600',
      meta: 'mt-2 text-[11px] text-slate-500',
      empty: 'px-4 py-8 text-center text-sm text-slate-500',
    }
  }, [dark])

  useEffect(() => {
    setLocalItems(items)
    setLocalUnreadCount(unreadCount)
    for (const item of items) {
      seenNotificationIdsRef.current.add(item.id)
    }
  }, [items, unreadCount])

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

        setLocalItems(nextData.notifications)
        setLocalUnreadCount(nextData.unreadCount)

        for (const item of nextData.notifications) {
          seenNotificationIdsRef.current.add(item.id)
        }

        for (const item of newUnreadItems.slice(0, 3)) {
          toast(item.title, {
            description: item.body.length > 120 ? `${item.body.slice(0, 117)}...` : item.body,
          })
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
      setLocalItems(prev => prev.map(item => ({ ...item, readAt: item.readAt ?? new Date() })))
      setLocalUnreadCount(0)
    })
  }

  function handleMarkSection(groupItems: NotificationItem[]) {
    const kinds = Array.from(new Set(groupItems.map((item) => item.kind)))
    startTransition(async () => {
      await markNotificationKindsRead(kinds)
      setLocalItems((prev) =>
        prev.map((item) =>
          kinds.includes(item.kind) && !item.readAt ? { ...item, readAt: new Date() } : item
        )
      )
      const unreadInGroup = groupItems.filter((item) => !item.readAt).length
      setLocalUnreadCount((prev) => Math.max(0, prev - unreadInGroup))
    })
  }

  function handleOpenNotification(notificationId: string) {
    startTransition(async () => {
      const existing = localItems.find(item => item.id === notificationId)
      await markNotificationRead(notificationId)
      setLocalItems(prev => prev.map(item => item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date() } : item))
      if (existing && !existing.readAt) {
        setLocalUnreadCount(prev => Math.max(0, prev - 1))
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
        {localUnreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {localUnreadCount > 9 ? '9+' : localUnreadCount}
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
                <p className={dark ? 'text-xs text-slate-500' : 'text-xs text-slate-500'}>{localUnreadCount} unread</p>
              </div>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isPending || localUnreadCount === 0}
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
