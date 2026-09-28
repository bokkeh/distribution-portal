'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reorderPinnedNavItems } from '@/actions/nav-preferences'

export type FavoriteNavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

function SortableFavoriteRow({
  item,
  active,
  onNav,
  onUnpin,
  theme,
}: {
  item: FavoriteNavItem
  active: boolean
  onNav?: () => void
  onUnpin: (href: string) => void
  theme: 'light' | 'dark'
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
        isDragging && 'opacity-50',
        theme === 'dark'
          ? active ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          : active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className={cn('cursor-grab p-2 active:cursor-grabbing', theme === 'dark' ? 'text-slate-500' : 'text-slate-300')}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Link href={item.href} onClick={onNav} className="flex flex-1 items-center gap-2.5 py-2 min-w-0">
        <Icon className={cn('h-4 w-4 flex-shrink-0', active ? (theme === 'dark' ? 'text-white' : 'text-blue-600') : 'text-slate-400')} />
        <span className="truncate">{item.label}</span>
      </Link>
      <button
        type="button"
        onClick={() => onUnpin(item.href)}
        className={cn('shrink-0 rounded p-1.5 mr-1', theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-300 hover:text-amber-500')}
        aria-label={`Unpin ${item.label}`}
        title="Unpin"
      >
        <Star className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  )
}

export function FavoritesSection({
  items,
  pathname,
  onNav,
  onUnpin,
  theme = 'light',
}: {
  items: FavoriteNavItem[]
  pathname: string
  onNav?: () => void
  onUnpin: (href: string) => void
  theme?: 'light' | 'dark'
}) {
  const [order, setOrder] = useState(items.map((item) => item.href))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setOrder((current) => {
      const known = new Set(items.map((item) => item.href))
      const kept = current.filter((href) => known.has(href))
      const added = items.map((item) => item.href).filter((href) => !kept.includes(href))
      return [...kept, ...added]
    })
  }, [items])

  const orderedItems = order
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is FavoriteNavItem => Boolean(item))

  if (orderedItems.length === 0) return null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(String(active.id))
    const newIndex = order.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(order, oldIndex, newIndex)
    setOrder(next)
    reorderPinnedNavItems(next).catch(() => {})
  }

  return (
    <div className="py-1">
      <p className={cn(
        'px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em]',
        theme === 'dark' ? 'text-amber-400' : 'text-amber-600',
      )}>
        Favorites
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {orderedItems.map((item) => (
              <SortableFavoriteRow
                key={item.href}
                item={item}
                active={pathname === item.href || pathname.startsWith(item.href + '/')}
                onNav={onNav}
                onUnpin={onUnpin}
                theme={theme}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
