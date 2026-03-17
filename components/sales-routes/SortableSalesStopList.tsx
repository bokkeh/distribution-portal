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
import { reorderSalesRouteStops, removeSalesRouteStop } from '@/actions/sales-routes'
import { Button } from '@/components/ui/button'
import { GripVertical, MapPin, Sparkles } from 'lucide-react'

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

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestNeighborOrder(stops: Stop[]): Stop[] {
  const geocoded = stops.filter((s) => s.lat !== null && s.lng !== null)
  const ungeocodable = stops.filter((s) => s.lat === null || s.lng === null)
  if (geocoded.length < 2) return stops

  const visited = new Set<string>()
  const result: Stop[] = [geocoded[0]]
  visited.add(geocoded[0].id)

  while (result.length < geocoded.length) {
    const current = result[result.length - 1]
    let nearestStop: Stop | null = null
    let nearestDist = Infinity

    for (const stop of geocoded) {
      if (visited.has(stop.id)) continue
      const d = haversineKm(
        { lat: current.lat!, lng: current.lng! },
        { lat: stop.lat!, lng: stop.lng! }
      )
      if (d < nearestDist) {
        nearestDist = d
        nearestStop = stop
      }
    }

    if (nearestStop) {
      result.push(nearestStop)
      visited.add(nearestStop.id)
    }
  }

  return [...result, ...ungeocodable]
}

function SortableStopCard({
  stop,
  index,
  routeId,
  onRemove,
  isRemoving,
}: {
  stop: Stop
  index: number
  routeId: string
  onRemove: (stopId: string) => void
  isRemoving: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{stop.companyName}</p>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            {stop.address}
          </p>
          {(stop.contactName || stop.contactPhone) && (
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {stop.contactName && <p>POC: {stop.contactName}</p>}
              {stop.contactPhone && <p>Phone: {stop.contactPhone}</p>}
            </div>
          )}
          {stop.notes && (
            <p className="mt-1.5 text-xs text-slate-500 italic">{stop.notes}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isRemoving}
          onClick={() => onRemove(stop.id)}
        >
          Remove
        </Button>
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
}: {
  routeId: string
  stops: Stop[]
}) {
  const [stops, setStops] = useState(initialStops)
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
    setStops(nextStops)

    startTransition(async () => {
      try {
        await reorderSalesRouteStops(routeId, nextStops.map((s) => s.id))
        toast.success('Stop order updated')
      } catch (error) {
        setStops(previousStops)
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
    const geocoded = stops.filter((s) => s.lat !== null && s.lng !== null)
    if (geocoded.length < 2) {
      toast.error('Not enough geocoded stops', {
        description: 'Most stops are missing coordinates. Try removing and re-adding them.',
      })
      return
    }

    const optimized = nearestNeighborOrder(stops).map((s, i) => ({ ...s, sequenceNumber: i + 1 }))
    const previousStops = stops
    setStops(optimized)
    setIsOptimizing(true)

    try {
      await reorderSalesRouteStops(routeId, optimized.map((s) => s.id))
      toast.success('Route optimized', { description: 'Stops reordered by shortest distance.' })
    } catch (error) {
      setStops(previousStops)
      toast.error('Unable to optimize route', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  function handleRemove(stopId: string) {
    const previousStops = stops
    const nextStops = stops
      .filter((s) => s.id !== stopId)
      .map((s, i) => ({ ...s, sequenceNumber: i + 1 }))

    setStops(nextStops)

    startTransition(async () => {
      try {
        await removeSalesRouteStop(routeId, stopId)
        toast.success('Stop removed')
      } catch (error) {
        setStops(previousStops)
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
