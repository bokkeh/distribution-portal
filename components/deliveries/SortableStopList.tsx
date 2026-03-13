'use client'

import { useMemo, useState, useTransition } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { reorderDeliveryStops, removeDeliveryStop } from '@/actions/deliveries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DriverStopActions } from '@/components/deliveries/DriverStopCard'
import { formatDate } from '@/lib/utils'
import { CheckCircle, Clock, GripVertical, MapPin, XCircle } from 'lucide-react'

type Stop = {
  id: string
  sequenceNumber: number
  address: string
  status: 'pending' | 'delivered' | 'failed'
  contactName: string | null
  contactPhone: string | null
  contactEmail?: string | null
  notes: string | null
  proofOfDeliveryUrl?: string | null
  shelfPhotoUrl?: string | null
  completedAt?: Date | null
  companyName: string | null
}

function StopStatusBadge({ status }: { status: Stop['status'] }) {
  return (
    <Badge
      variant={
        status === 'delivered'
          ? 'success'
          : status === 'failed'
            ? 'destructive'
            : 'secondary'
      }
    >
      {status}
    </Badge>
  )
}

function StopStatusIcon({ status }: { status: Stop['status'] }) {
  if (status === 'delivered') return <CheckCircle className="w-4 h-4 text-green-500" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />
  return <Clock className="w-4 h-4 text-yellow-500" />
}

function SortableStopCard({
  stop,
  index,
  mode,
  deliveryId,
  onRemove,
  isRemoving,
}: {
  stop: Stop
  index: number
  mode: 'admin' | 'driver'
  deliveryId: string
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
      className={`rounded-lg border p-3 bg-white ${isDragging ? 'opacity-40 shadow-lg' : ''}`}
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
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {index + 1}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{stop.companyName}</p>
            {mode === 'driver' ? <StopStatusBadge status={stop.status} /> : null}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{stop.address}
          </p>
          {(stop.contactName || stop.contactPhone || stop.contactEmail) && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {stop.contactName && <p>POC: {stop.contactName}</p>}
              {stop.contactPhone && <p>Phone: {stop.contactPhone}</p>}
              {stop.contactEmail && <p>Email: {stop.contactEmail}</p>}
            </div>
          )}
          {mode === 'admin' && stop.completedAt && (
            <p className="mt-1 text-xs text-muted-foreground">Completed {formatDate(stop.completedAt)}</p>
          )}
          {mode === 'driver' && (
            <div className="mt-3">
              <DriverStopActions
                stop={{
                  id: stop.id,
                  status: stop.status,
                  notes: stop.notes,
                  proofOfDeliveryUrl: stop.proofOfDeliveryUrl,
                  shelfPhotoUrl: stop.shelfPhotoUrl,
                }}
              />
            </div>
          )}
        </div>
        {mode === 'admin' && (
          <div className="flex items-start gap-2">
            <StopStatusIcon status={stop.status} />
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
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
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

export default function SortableStopList({
  deliveryId,
  stops: initialStops,
  mode,
}: {
  deliveryId: string
  stops: Stop[]
  mode: 'admin' | 'driver'
}) {
  const [stops, setStops] = useState(initialStops)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeStop = useMemo(() => stops.find(stop => stop.id === activeId) ?? null, [stops, activeId])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stops.findIndex(stop => stop.id === active.id)
    const newIndex = stops.findIndex(stop => stop.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const nextStops = arrayMove(stops, oldIndex, newIndex).map((stop, index) => ({
      ...stop,
      sequenceNumber: index + 1,
    }))
    const previousStops = stops

    setStops(nextStops)

    startTransition(async () => {
      try {
        await reorderDeliveryStops(deliveryId, nextStops.map(stop => stop.id))
        toast.success('Stop order updated')
      } catch (error) {
        setStops(previousStops)
        toast.error('Unable to reorder stops', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  function handleRemove(stopId: string) {
    if (mode !== 'admin') return

    const previousStops = stops
    const nextStops = stops
      .filter(stop => stop.id !== stopId)
      .map((stop, index) => ({
        ...stop,
        sequenceNumber: index + 1,
      }))

    setStops(nextStops)

    startTransition(async () => {
      try {
        await removeDeliveryStop(deliveryId, stopId)
        toast.success('Stop removed')
      } catch (error) {
        setStops(previousStops)
        toast.error('Unable to remove stop', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={stops.map(stop => stop.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {stops.map((stop, index) => (
            <SortableStopCard
              key={stop.id}
              stop={stop}
              index={index}
              mode={mode}
              deliveryId={deliveryId}
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
