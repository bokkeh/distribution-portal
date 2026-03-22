'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { reorderDeliveryStops, removeDeliveryStop, updateDeliveryStop, setDeliveryOrigin } from '@/actions/deliveries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DriverStopActions } from '@/components/deliveries/DriverStopCard'
import { getDeliveryStopAdditionalPhotos } from '@/lib/deliveries/photos'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import { CheckCircle, Check, Clock, GripVertical, Home, ImageIcon, MapPin, Pencil, X, XCircle } from 'lucide-react'
import GetDirectionsButton from '@/components/shared/GetDirectionsButton'

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
  additionalPhotoUrl?: string | null
  additionalPhotoUrl2?: string | null
  additionalPhotoUrl3?: string | null
  additionalPhotoUrl4?: string | null
  additionalPhotoUrl5?: string | null
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
  onUpdate,
  isRemoving,
}: {
  stop: Stop
  index: number
  mode: 'admin' | 'driver'
  deliveryId: string
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
      const result = await updateDeliveryStop(deliveryId, stop.id, {
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
      className={`rounded-lg border bg-white p-3 sm:p-4 ${isDragging ? 'opacity-40 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-3">
        {mode === 'admin' && (
          <button
            {...attributes}
            {...listeners}
            className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder stop"
            type="button"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {index + 1}
        </div>

        {editing && mode === 'admin' ? (
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold leading-tight">{stop.companyName ?? stop.address}</p>
              {mode === 'driver' ? <StopStatusBadge status={stop.status} /> : null}
            </div>
            {stop.companyName && (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />{stop.address}
              </p>
            )}
            {(stop.contactName || stop.contactPhone || stop.contactEmail) && (
              <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {stop.contactName && <p>POC: {stop.contactName}</p>}
                {stop.contactPhone && <p>Phone: {stop.contactPhone}</p>}
                {stop.contactEmail && <p>Email: {stop.contactEmail}</p>}
              </div>
            )}
            {mode === 'admin' && stop.completedAt && (
              <p className="mt-1 text-xs text-muted-foreground">Completed {formatDate(stop.completedAt)}</p>
            )}
            {mode === 'admin' && (stop.proofOfDeliveryUrl || stop.shelfPhotoUrl || getDeliveryStopAdditionalPhotos(stop).length > 0) && (
              <div className="mt-2 flex gap-2">
                {([
                  { url: stop.proofOfDeliveryUrl, label: 'POD', title: 'Proof of delivery' },
                  { url: stop.shelfPhotoUrl, label: 'Shelf', title: 'Shelf photo' },
                  ...getDeliveryStopAdditionalPhotos(stop).map((url, index) => ({
                    url,
                    label: `Extra ${index + 1}`,
                    title: `Additional photo ${index + 1}`,
                  })),
                ] as { url: string | null | undefined; label: string; title: string }[]).filter(p => p.url).map(({ url, label, title }) => (
                  <a
                    key={label}
                    href={url!}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    title={title}
                  >
                    <Image
                      src={url!}
                      alt={title}
                      fill
                      className="object-cover transition-opacity group-hover:opacity-80"
                      unoptimized
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-center text-[9px] font-medium text-white">{label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'admin' && !editing && (
          <div className="flex items-start gap-1">
            <StopStatusIcon status={stop.status} />
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

      {mode === 'driver' && !editing && (
        <div className="mt-4 border-t pt-4">
          <DriverStopActions stop={{
            id: stop.id,
            status: stop.status,
            notes: stop.notes,
            proofOfDeliveryUrl: stop.proofOfDeliveryUrl,
            shelfPhotoUrl: stop.shelfPhotoUrl,
            additionalPhotoUrl: stop.additionalPhotoUrl,
            additionalPhotoUrl2: stop.additionalPhotoUrl2,
            additionalPhotoUrl3: stop.additionalPhotoUrl3,
            additionalPhotoUrl4: stop.additionalPhotoUrl4,
            additionalPhotoUrl5: stop.additionalPhotoUrl5,
          }} />
        </div>
      )}
    </div>
  )
}

function HombaseRow({
  deliveryId,
  currentAddress,
  onSaved,
}: {
  deliveryId: string
  currentAddress: string | null
  onSaved?: (address: string) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!currentAddress)
  const [value, setValue] = useState(currentAddress ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('originAddress', value.trim())
      const result = await setDeliveryOrigin(deliveryId, formData)
      if (result && 'error' in result && result.error) {
        toast.error(result.error as string)
        return
      }
      toast.success(value.trim() ? 'Starting location saved' : 'Starting location cleared')
      setEditing(false)
      onSaved?.(value.trim())
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-2.5 sm:p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400"><Home className="w-4 h-4" /></div>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">H</div>
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Enter starting address (warehouse, depot, etc.)"
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
  originAddress: initialOriginAddress,
}: {
  deliveryId: string
  stops: Stop[]
  mode: 'admin' | 'driver'
  originAddress?: string | null
}) {
  const [stops, setStops] = useState(initialStops)
  const [originAddress, setOriginAddress] = useState(initialOriginAddress ?? null)
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

  function handleUpdate(stopId: string, data: Partial<Stop>) {
    setStops(prev => prev.map(s => s.id === stopId ? { ...s, ...data } : s))
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
    <div className="space-y-2 sm:space-y-3">
      {mode === 'admin' && (
        <HombaseRow deliveryId={deliveryId} currentAddress={originAddress} onSaved={setOriginAddress} />
      )}
      {stops.length > 0 && (
        <div className="pt-1">
          <GetDirectionsButton
            stops={stops.map(s => ({ address: s.address }))}
            originAddress={originAddress}
          />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={stops.map(stop => stop.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 sm:space-y-3">
            {stops.map((stop, index) => (
              <SortableStopCard
                key={stop.id}
                stop={stop}
                index={index}
                mode={mode}
                deliveryId={deliveryId}
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
    </div>
  )
}
