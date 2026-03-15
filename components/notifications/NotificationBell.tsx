'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { markAllNotificationsRead, markNotificationRead } from '@/actions/user-notifications'

type NotificationItem = {
  id: string
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
  const [isPending, startTransition] = useTransition()

  const classes = useMemo(() => {
    if (dark) {
      return {
        button: 'relative rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 hover:border-slate-500 hover:text-white',
        panel: 'absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl',
        item: 'block rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left hover:border-slate-600',
        title: 'text-sm font-semibold text-white',
        body: 'mt-1 text-xs text-slate-300',
        meta: 'mt-2 text-[11px] text-slate-500',
        empty: 'px-4 py-8 text-center text-sm text-slate-400',
      }
    }

    return {
      button: 'relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:border-slate-300 hover:text-slate-900',
      panel: 'absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl',
      item: 'block rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-slate-200',
      title: 'text-sm font-semibold text-slate-900',
      body: 'mt-1 text-xs text-slate-600',
      meta: 'mt-2 text-[11px] text-slate-500',
      empty: 'px-4 py-8 text-center text-sm text-slate-500',
    }
  }, [dark])

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

  return (
    <div className="relative">
      <button
        type="button"
        className={classes.button}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4" />
        {localUnreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {localUnreadCount > 9 ? '9+' : localUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className={classes.panel}>
            <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
              <div>
                <p className={dark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-slate-900'}>Notifications</p>
                <p className={dark ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>{localUnreadCount} unread</p>
              </div>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isPending || localUnreadCount === 0}
                className={dark ? 'text-xs text-slate-300 hover:text-white disabled:text-slate-600' : 'text-xs text-slate-600 hover:text-slate-900 disabled:text-slate-300'}
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4">
              {localItems.length ? localItems.map(item => {
                const content = (
                  <div className={classes.item}>
                    <div className="flex items-start justify-between gap-3">
                      <p className={classes.title}>{item.title}</p>
                      {!item.readAt ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" /> : null}
                    </div>
                    <p className={classes.body}>{item.body}</p>
                    <p className={classes.meta}>{formatTime(item.createdAt)}</p>
                  </div>
                )

                if (item.href) {
                  return (
                    <Link key={item.id} href={item.href} onClick={() => handleOpenNotification(item.id)}>
                      {content}
                    </Link>
                  )
                }

                return (
                  <button key={item.id} type="button" className="w-full text-left" onClick={() => handleOpenNotification(item.id)}>
                    {content}
                  </button>
                )
              }) : (
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
