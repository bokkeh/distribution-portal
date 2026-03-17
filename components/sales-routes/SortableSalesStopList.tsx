'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { reorderSalesRouteStops, removeSalesRouteStop, optimizeSalesRouteOrder, updateSalesRouteStop } from '@/actions/sales-routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, MapPin, Sparkles, Pencil, X, Check } from 'lucide-react'

type Stop = {
  id: string
  sequenceNumber: number
  address: string
  contactName: string | null
  contactPhone: string | null
  notes: string | null
  companyName: string | null
  lat: number | null
  lng: number | null
}


function SortableStopCard({
  stop,
  index,
  routeId,
  onRemove,
  onUpdate,
  isRemoving,
}: {
  stop: Stop
  index: number
  routeId: string
  onRemove: (stopId: string) => void
  onUpdate: (stopId: string, data: Partial<Stop>) => void
  isRemoving: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [address, setAddress] = useState(stop.address)
  const [contactName, setContactName] = useState(stop.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(stop.contactPhone ?? '')
  const [notes, setNotes] = useState(stop.notes ?? '')

  const style = { transform: CSS.Transform.toString(transform), transition }

  async function handleSave() {
    if (!address.trim()) return
    setIsSaving(true)
    try {
      const result = await updateSalesRouteStop(routeId, stop.id, {
        address: address.trim(),
        contactName: contactName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        notes: notes.trim() || null,
      })
      if (result?.success) {
        onUpdate(stop.id, { address: address.trim(), contactName: contactName.trim() || null, contactPhone: contactPhone.trim() || null, notes: notes.trim() || null })
        setEditing(false)
        toast.success('Stop updated')
      }
    } catch {
      toast.error('Failed to update stop')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white p-2.5 sm:p-3 ${isDragging ? 'opacity-40 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder stop"
          type="button"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {index + 1}
        </div>

        {editing ? (
          <div className="flex-1 space-y-2">
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="h-8 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Contact phone" className="h-8 text-sm" />
            </div>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-8 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving || !address.trim()}>
                <Check className="w-3.5 h-3.5 mr-1" />{isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isSaving}>
                <X className="w-3.5 h-3.5 mr-1" />Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">{stop.companyName ?? stop.address}</p>
            {stop.companyName && (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />{stop.address}
              </p>
            )}
            {(stop.contactName || stop.contactPhone) && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {stop.contactName && <p>POC: {stop.contactName}</p>}
                {stop.contactPhone && <p>Phone: {stop.contactPhone}</p>}
              </div>
            )}
            {stop.notes && <p className="mt-1 text-xs text-slate-500 italic">{stop.notes}</p>}
          </div>
        )}

        {!editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Edit stop"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <Button type="button" variant="outline" size="sm" disabled={isRemoving} onClick={() => onRemove(stop.id)}>
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function DragPreview({ stop }: { stop: Stop }) {
  return (
    <div className="w-full max-w-xl rounded-lg border bg-white p-3 shadow-xl">
      <div className="flex items-center gap-3">
        <GripVertical className="w-4 h-4 text-slate-300" />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {stop.sequenceNumber}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{stop.companyName}</p>
          <p className="text-xs text-muted-foreground">{stop.address}</p>
        </div>
      </div>
    </div>
  )
}

export default function SortableSalesStopList({
  routeId,
  stops: initialStops,
  onStopsChange,
  origin,
}: {
  routeId: string
  stops: Stop[]
  onStopsChange?: (stops: Stop[]) => void
  origin?: { lat: number; lng: number } | null
}) {
  const [stops, setStops] = useState(initialStops)

  function applyStops(next: Stop[]) {
    setStops(next)
    onStopsChange?.(next)
  }
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isOptimizing, setIsOptimizing] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeStop = useMemo(() => stops.find((s) => s.id === activeId) ?? null, [stops, activeId])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stops.findIndex((s) => s.id === active.id)
    const newIndex = stops.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const nextStops = arrayMove(stops, oldIndex, newIndex).map((s, i) => ({
      ...s,
      sequenceNumber: i + 1,
    }))
    const previousStops = stops
    applyStops(nextStops)

    startTransition(async () => {
      try {
        await reorderSalesRouteStops(routeId, nextStops.map((s) => s.id))
        toast.success('Stop order updated')
      } catch (error) {
        applyStops(previousStops)
        toast.error('Unable to reorder stops', {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    })
  }

  async function handleOptimize() {
    if (stops.length < 2) {
      toast.info('Add at least 2 stops to optimize the route.')
      return
    }
    const geocodedCount = stops.filter((s) => s.lat !== null && s.lng !== null).length
    if (geocodedCount < 2) {
      toast.error('Not enough geocoded stops', {
        description: 'Most stops are missing coordinates. Try removing and re-adding them.',
      })
      return
    }

    setIsOptimizing(true)
    const previousStops = stops

    try {
      const stopCoords = stops.map((s) => ({ id: s.id, lat: s.lat ?? 0, lng: s.lng ?? 0 }))
      const { orderedIds } = await optimizeSalesRouteOrder(routeId, stopCoords, origin ?? null)

      const idToStop = new Map(stops.map((s) => [s.id, s]))
      const optimized = orderedIds
        .map((id, i) => idToStop.get(id) ? { ...idToStop.get(id)!, sequenceNumber: i + 1 } : null)
        .filter((s): s is Stop => s !== null)

      applyStops(optimized)
      toast.success('Best route calculated', { description: 'Stops reordered for fastest driving time.' })
    } catch (error) {
      applyStops(previousStops)
      toast.error('Unable to optimize route', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  function handleUpdate(stopId: string, data: Partial<Stop>) {
    applyStops(stops.map(s => s.id === stopId ? { ...s, ...data } : s))
  }

  function handleRemove(stopId: string) {
    const previousStops = stops
    const nextStops = stops
      .filter((s) => s.id !== stopId)
      .map((s, i) => ({ ...s, sequenceNumber: i + 1 }))

    applyStops(nextStops)

    startTransition(async () => {
      try {
        await removeSalesRouteStop(routeId, stopId)
        toast.success('Stop removed')
      } catch (error) {
        applyStops(previousStops)
        toast.error('Unable to remove stop', {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    })
  }

  if (stops.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No stops yet. Add accounts to build the route.
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOptimize}
          disabled={isOptimizing || isPending || stops.length < 2}
          className="gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50 hover:border-violet-300"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isOptimizing ? 'Optimizing...' : 'Generate Best Route'}
        </Button>
      </div>
      <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 sm:space-y-3">
          {stops.map((stop, index) => (
            <SortableStopCard
              key={stop.id}
              stop={stop}
              index={index}
              routeId={routeId}
              onRemove={handleRemove}
              onUpdate={handleUpdate}
              isRemoving={isPending}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeStop ? <DragPreview stop={activeStop} /> : null}
      </DragOverlay>
    </DndContext>
  )

}
