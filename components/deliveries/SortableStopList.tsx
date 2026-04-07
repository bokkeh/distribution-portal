'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { reorderDeliveryStops, removeDeliveryStop, setDeliveryOrigin, startDeliveryForStop, syncDeliveryStopFromAccount, updateDeliveryStop } from '@/actions/deliveries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DriverStopActions } from '@/components/deliveries/DriverStopCard'
import { getDeliveryStopAdditionalPhotos } from '@/lib/deliveries/photos'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import { CheckCircle, Check, ChevronDown, ChevronUp, Clock, GripVertical, Home, Loader2, MapPin, Pencil, RefreshCw, Send, X, XCircle } from 'lucide-react'
import GetDirectionsButton from '@/components/shared/GetDirectionsButton'

type Stop = {
  id: string
  sequenceNumber: number
  address: string
  status: 'pending' | 'delivered' | 'failed'
  customerStatus?: 'not_started' | 'out_for_delivery' | 'arriving_soon' | 'arrived' | 'delivered' | 'failed'
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
  trackingEnabled?: boolean
  trackingToken?: string | null
  etaMinutes?: number | null
  lastLocationAt?: Date | null
  recipientSignatureUrl?: string | null
  recipientSignedName?: string | null
  lat?: string | null
  lng?: string | null
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
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isRemoving,
  routeHasActiveStop = false,
  emphasis = 'default',
  onCompleted,
  cardRef,
}: {
  stop: Stop
  index: number
  mode: 'admin' | 'driver'
  deliveryId: string
  onRemove: (stopId: string) => void
  onUpdate: (stopId: string, data: Partial<Stop>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  isRemoving: boolean
  routeHasActiveStop?: boolean
  emphasis?: 'default' | 'next' | 'active'
  onCompleted?: () => void
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [isStartingForDriver, startStartingForDriver] = useTransition()
  const [address, setAddress] = useState(stop.address)
  const [contactName, setContactName] = useState(stop.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(stop.contactPhone ?? '')
  const [notes, setNotes] = useState(stop.notes ?? '')
  const canReorder = mode === 'admin' || mode === 'driver'
  const router = useRouter()
  const stopTrackingActive = stop.status === 'pending' && ['out_for_delivery', 'arriving_soon', 'arrived'].includes(stop.customerStatus ?? 'not_started')
  const adminCanStartForDriver = mode === 'admin' && stop.status === 'pending' && !stopTrackingActive
  const adminStartBlockedByOtherStop = adminCanStartForDriver && routeHasActiveStop

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

  async function handleSyncFromAccount() {
    setIsSyncing(true)
    try {
      const result = await syncDeliveryStopFromAccount(deliveryId, stop.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setAddress(result.address ?? address)
        onUpdate(stop.id, { address: result.address ?? address })
        toast.success('Address synced from account')
      }
    } catch {
      toast.error('Failed to sync address')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleAdminStartForDriver() {
    startStartingForDriver(async () => {
      try {
        await startDeliveryForStop(stop.id)
        onUpdate(stop.id, {
          customerStatus: 'out_for_delivery',
          trackingEnabled: true,
        })
        toast.success('Delivery started for assigned driver')
        router.refresh()
      } catch (error) {
        toast.error('Unable to start delivery', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  return (
    <div
      ref={(el) => { setNodeRef(el); cardRef?.(el) }}
      style={style}
      className={`rounded-lg border bg-white p-3 sm:p-4 ${
        emphasis === 'active'
          ? 'border-emerald-200 bg-emerald-50/60 shadow-sm'
          : emphasis === 'next'
            ? 'border-blue-200 bg-blue-50/60 shadow-sm'
            : ''
      } ${isDragging ? 'opacity-40 shadow-lg' : ''}`}
    >
      {mode === 'driver' && emphasis !== 'default' ? (
        <div className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
          emphasis === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {emphasis === 'active' ? 'Active Delivery' : 'Next Action'}
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        {canReorder && (
          <div className="flex flex-col items-center gap-0.5 mt-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move stop up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              {...attributes}
              {...listeners}
              className="text-slate-300 transition-colors hover:text-slate-500 cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder"
              type="button"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move stop down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {index + 1}
        </div>

        {editing && mode === 'admin' ? (
          <div className="flex-1 space-y-2">
            <div className="flex gap-1.5">
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="h-8 text-sm" />
              <button
                type="button"
                onClick={handleSyncFromAccount}
                disabled={isSyncing}
                className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                title="Pull address from linked account"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>
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
              <p className={`mt-0.5 flex items-start gap-1 text-xs ${stop.address.startsWith('Address not') ? 'font-medium text-amber-600' : 'text-muted-foreground'}`}>
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
                    href={signedPhotoUrl(url) ?? url!}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    title={title}
                  >
                    <Image
                      src={signedPhotoUrl(url) ?? url!}
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
            {adminCanStartForDriver ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isStartingForDriver || adminStartBlockedByOtherStop}
                onClick={handleAdminStartForDriver}
                title={adminStartBlockedByOtherStop ? 'Another stop is already active on this route.' : 'Start delivery on behalf of the assigned driver'}
              >
                {isStartingForDriver ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Start for Driver
              </Button>
            ) : null}
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
          {collapsed ? (
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 text-sm font-medium ${stop.status === 'failed' ? 'text-red-600' : 'text-green-600'}`}>
                {stop.status === 'failed' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {stop.status === 'failed' ? 'Marked failed' : 'Delivered'}
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="text-xs text-blue-600 underline"
              >
                View details
              </button>
            </div>
          ) : (
            <DriverStopActions stop={{
              id: stop.id,
              status: stop.status,
              customerStatus: stop.customerStatus,
              notes: stop.notes,
              proofOfDeliveryUrl: stop.proofOfDeliveryUrl,
              shelfPhotoUrl: stop.shelfPhotoUrl,
              additionalPhotoUrl: stop.additionalPhotoUrl,
              additionalPhotoUrl2: stop.additionalPhotoUrl2,
              additionalPhotoUrl3: stop.additionalPhotoUrl3,
              additionalPhotoUrl4: stop.additionalPhotoUrl4,
              additionalPhotoUrl5: stop.additionalPhotoUrl5,
              trackingEnabled: stop.trackingEnabled,
              trackingToken: stop.trackingToken,
              etaMinutes: stop.etaMinutes,
              lastLocationAt: stop.lastLocationAt,
              recipientSignatureUrl: stop.recipientSignatureUrl,
              recipientSignedName: stop.recipientSignedName,
              lat: stop.lat,
              lng: stop.lng,
            }} routeHasActiveStop={routeHasActiveStop} onCompleted={() => { setCollapsed(true); onCompleted?.() }} />
          )}
        </div>
      )}
    </div>
  )
}

function CompletedStopCard({ stop }: { stop: Stop }) {
  return (
    <div className="rounded-lg border bg-white p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
          <CheckCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold leading-tight">{stop.companyName ?? stop.address}</p>
            <StopStatusBadge status={stop.status} />
          </div>
          {stop.companyName ? (
            <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              {stop.address}
            </p>
          ) : null}
          <div className="mt-3">
            <DriverStopActions stop={stop} />
          </div>
        </div>
      </div>
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
  const stopRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const pendingStops = useMemo(() => stops.filter((stop) => stop.status === 'pending'), [stops])
  const completedStops = useMemo(() => stops.filter((stop) => stop.status !== 'pending'), [stops])
  const routeTrackedStop = useMemo(
    () => pendingStops.find((stop) => ['out_for_delivery', 'arriving_soon', 'arrived'].includes(stop.customerStatus ?? 'not_started')) ?? null,
    [pendingStops],
  )
  const activeTrackedStop = useMemo(
    () => mode === 'driver'
      ? routeTrackedStop
      : null,
    [mode, routeTrackedStop],
  )
  const leadStop = useMemo(
    () => mode === 'driver' ? activeTrackedStop ?? pendingStops[0] ?? null : null,
    [activeTrackedStop, mode, pendingStops],
  )
  const sortableStops = useMemo(
    () => mode === 'driver'
      ? [
          ...(leadStop ? [leadStop] : []),
          ...pendingStops.filter((stop) => stop.id !== leadStop?.id),
        ]
      : stops,
    [leadStop, mode, pendingStops, stops],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeStop = useMemo(() => sortableStops.find(stop => stop.id === activeId) ?? null, [sortableStops, activeId])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortableStops.findIndex(stop => stop.id === active.id)
    const newIndex = sortableStops.findIndex(stop => stop.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reorderedPending = arrayMove(sortableStops, oldIndex, newIndex).map((stop, index) => ({
      ...stop,
      sequenceNumber: index + 1,
    }))
    const nextStops = mode === 'driver'
      ? [
          ...reorderedPending,
          ...completedStops.map((stop, index) => ({
            ...stop,
            sequenceNumber: reorderedPending.length + index + 1,
          })),
        ]
      : reorderedPending
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

  function handleMove(stopId: string, direction: 'up' | 'down') {
    const list = mode === 'driver' ? sortableStops : stops
    const oldIndex = list.findIndex(s => s.id === stopId)
    const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1
    if (newIndex < 0 || newIndex >= list.length) return

    const reordered = arrayMove(list, oldIndex, newIndex).map((s, i) => ({ ...s, sequenceNumber: i + 1 }))
    const nextStops = mode === 'driver'
      ? [
          ...reordered,
          ...completedStops.map((s, i) => ({ ...s, sequenceNumber: reordered.length + i + 1 })),
        ]
      : reordered
    const previousStops = stops
    setStops(nextStops)

    startTransition(async () => {
      try {
        await reorderDeliveryStops(deliveryId, nextStops.map(s => s.id))
      } catch (error) {
        setStops(previousStops)
        toast.error('Unable to reorder stops', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  function handleStopCompleted(stopId: string) {
    const nextPending = sortableStops.find((s) => s.id !== stopId && s.status === 'pending')
    if (!nextPending) return
    setTimeout(() => {
      const el = stopRefs.current.get(nextPending.id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)
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
      {mode === 'driver' && stops.length > 1 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Use the arrows or drag the grip handle to set your preferred route order.
        </div>
      )}
      {(mode === 'driver' ? sortableStops : stops).length > 0 && (
        <div className="pt-1">
          <GetDirectionsButton
            stops={(mode === 'driver' ? sortableStops : stops).map(s => ({ address: s.address }))}
            originAddress={originAddress}
          />
        </div>
      )}
      <DndContext id={`stop-list-${deliveryId}`} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableStops.map(stop => stop.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 sm:space-y-3">
            {sortableStops.map((stop, index) => (
              <SortableStopCard
                key={stop.id}
                stop={stop}
                index={index}
                mode={mode}
                deliveryId={deliveryId}
                onRemove={handleRemove}
                onUpdate={handleUpdate}
                onMoveUp={() => handleMove(stop.id, 'up')}
                onMoveDown={() => handleMove(stop.id, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < sortableStops.length - 1}
                isRemoving={isPending}
                routeHasActiveStop={Boolean(routeTrackedStop && routeTrackedStop.id !== stop.id)}
                emphasis={mode === 'driver' && stop.id === leadStop?.id ? (activeTrackedStop ? 'active' : 'next') : 'default'}
                onCompleted={() => handleStopCompleted(stop.id)}
                cardRef={(el) => {
                  if (el) stopRefs.current.set(stop.id, el)
                  else stopRefs.current.delete(stop.id)
                }}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeStop ? <DragPreview stop={activeStop} /> : null}
        </DragOverlay>
      </DndContext>

      {mode === 'driver' && completedStops.length > 0 ? (
        <>
          <details className="rounded-xl border border-slate-200 bg-white sm:hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">
              Completed and Failed Stops ({completedStops.length})
            </summary>
            <div className="space-y-2 border-t border-slate-100 px-3 py-3">
              {completedStops.map((stop) => (
                <CompletedStopCard key={stop.id} stop={stop} />
              ))}
            </div>
          </details>

          <div className="hidden space-y-2 sm:block">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Completed and Failed Stops</p>
              <Badge variant="outline">{completedStops.length}</Badge>
            </div>
            {completedStops.map((stop) => (
              <CompletedStopCard key={stop.id} stop={stop} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
