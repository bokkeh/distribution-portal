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
import { reorderSalesRouteStops, removeSalesRouteStop, optimizeSalesRouteOrder, updateSalesRouteStop, updateSalesRouteStopVisit, setRouteOrigin } from '@/actions/sales-routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Home, MapPin, Sparkles, Pencil, X, Check, Camera, Loader2 } from 'lucide-react'
import GetDirectionsButton from '@/components/shared/GetDirectionsButton'

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
  visitPhotoUrl?: string | null
  visitedAt?: string | Date | null
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
  const [visitPhotoUrl, setVisitPhotoUrl] = useState(stop.visitPhotoUrl ?? '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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

  async function handleVisitPhotoUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    setUploadingPhoto(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('folder', 'sales-routes')
      uploadFormData.append('filename', `sales-stop-${stop.id}-${file.name}`)

      const response = await fetch('/api/upload', { method: 'POST', body: uploadFormData })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Upload failed')

      const nextPhotoUrl = payload.publicUrl as string
      setVisitPhotoUrl(nextPhotoUrl)
      await updateSalesRouteStopVisit(routeId, stop.id, {
        visitPhotoUrl: nextPhotoUrl,
        notes: notes.trim() || stop.notes || null,
      })
      onUpdate(stop.id, { visitPhotoUrl: nextPhotoUrl, visitedAt: new Date().toISOString() })
      toast.success('Visit photo uploaded')
    } catch (error) {
      toast.error('Failed to upload visit photo', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploadingPhoto(false)
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50">
                  {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {visitPhotoUrl ? 'Replace visit photo' : 'Upload visit photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleVisitPhotoUpload(file)
                  }}
                />
              </label>
              {visitPhotoUrl && (
                <a href={visitPhotoUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 underline">
                  View photo
                </a>
              )}
              {stop.visitedAt && (
                <span className="text-xs text-muted-foreground">
                  Visited {new Date(stop.visitedAt).toLocaleString()}
                </span>
              )}
            </div>
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

function HombaseRow({
  routeId,
  currentAddress,
  onSaved,
}: {
  routeId: string
  currentAddress: string | null
  onSaved: (address: string | null, lat: number | null, lng: number | null) => void
}) {
  const [editing, setEditing] = useState(!currentAddress)
  const [value, setValue] = useState(currentAddress ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      if (value.trim() && value.trim() !== (currentAddress ?? '')) {
        const confirmed = window.confirm(
          'Saving a new starting location will make a billable Google Geocoding API request. Continue?'
        )
        if (!confirmed) return
      }

      const formData = new FormData()
      formData.append('originAddress', value.trim())
      const result = await setRouteOrigin(routeId, formData)
      if (result && 'error' in result && result.error) {
        toast.error(result.error as string)
        return
      }
      toast.success(value.trim() ? 'Starting location saved' : 'Starting location cleared')
      onSaved(value.trim() || null, null, null)
      setEditing(false)
    })
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-2.5 sm:p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">
          <Home className="w-4 h-4" />
        </div>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
          H
        </div>
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Enter starting address (warehouse, home, etc.)"
              className="h-8 text-sm w-full"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setValue(currentAddress ?? '') } }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                <Check className="w-3.5 h-3.5 mr-1" />{isPending ? 'Saving...' : 'Save'}
              </Button>
              {currentAddress && (
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(currentAddress) }} disabled={isPending}>
                  <X className="w-3.5 h-3.5 mr-1" />Cancel
                </Button>
              )}
            </div>
            <p className="text-[11px] font-medium text-red-600">Warning: saving this address triggers a billable Google Geocoding API call.</p>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700">Starting Location</p>
            <p className="text-xs text-muted-foreground mt-0.5">{currentAddress}</p>
          </div>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Edit starting location"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
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
  originAddress: initialOriginAddress,
  onOriginChange,
}: {
  routeId: string
  stops: Stop[]
  onStopsChange?: (stops: Stop[]) => void
  origin?: { lat: number; lng: number } | null
  originAddress?: string | null
  onOriginChange?: (address: string | null, lat: number | null, lng: number | null) => void
}) {
  const [stops, setStops] = useState(initialStops)
  const [originAddress, setOriginAddress] = useState(initialOriginAddress ?? null)

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

    const confirmed = window.confirm(
      'This will make a billable Google Directions API optimization request. Continue?'
    )
    if (!confirmed) return

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

  function handleOriginSaved(address: string | null, lat: number | null, lng: number | null) {
    setOriginAddress(address)
    onOriginChange?.(address, lat, lng)
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

  return (
    <div className="space-y-2 sm:space-y-3">
      <HombaseRow
        routeId={routeId}
        currentAddress={originAddress}
        onSaved={handleOriginSaved}
      />

      {stops.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No stops yet. Add accounts to build the route.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="mb-3 pt-1 flex flex-wrap gap-2">
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
            <GetDirectionsButton
              stops={stops.map(s => ({ address: s.address, lat: s.lat, lng: s.lng }))}
              originAddress={originAddress}
            />
          </div>
          <p className="mt-[-4px] mb-3 text-[11px] font-medium text-red-600">Warning: route optimization and live in-app directions can trigger billable Google Directions API usage.</p>
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
      )}
    </div>
  )

}
