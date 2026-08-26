'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DeliveryGalleryPhoto = {
  url: string
  label: string
  stopLabel: string
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

export function DeliveryPhotoGallery({
  photos,
  thumbnailVariant = 'detailed',
}: {
  photos: DeliveryGalleryPhoto[]
  thumbnailVariant?: 'detailed' | 'compact'
}) {
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const descriptionId = useId()

  const resetTransform = useCallback(() => {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
    dragStart.current = null
  }, [])

  const openPhoto = (index: number) => {
    setSelectedIndex(index)
    resetTransform()
    setOpen(true)
  }

  const showPhoto = useCallback((index: number) => {
    setSelectedIndex((index + photos.length) % photos.length)
    resetTransform()
  }, [photos.length, resetTransform])

  const showPrevious = useCallback(() => {
    setSelectedIndex(current => (current - 1 + photos.length) % photos.length)
    resetTransform()
  }, [photos.length, resetTransform])

  const showNext = useCallback(() => {
    setSelectedIndex(current => (current + 1) % photos.length)
    resetTransform()
  }, [photos.length, resetTransform])

  const changeZoom = useCallback((nextZoom: number) => {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    setZoom(clampedZoom)
    if (clampedZoom === MIN_ZOOM) setPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && photos.length > 1) showPrevious()
      if (event.key === 'ArrowRight' && photos.length > 1) showNext()
      if (event.key === '+' || event.key === '=') changeZoom(zoom + ZOOM_STEP)
      if (event.key === '-') changeZoom(zoom - ZOOM_STEP)
      if (event.key === '0') resetTransform()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeZoom, open, photos.length, resetTransform, showNext, showPrevious, zoom])

  if (photos.length === 0) return null

  const currentPhoto = photos[selectedIndex] ?? photos[0]
  const zoomPercent = Math.round(zoom * 100)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <Dialog.Trigger asChild key={`${photo.url}-${index}`}>
            <button
              type="button"
              onClick={() => openPhoto(index)}
              className="group text-left focus-visible:outline-none"
              aria-label={`Open ${photo.label} photo for ${photo.stopLabel} in gallery`}
            >
              <span className={cn(
                'relative block overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition group-hover:border-orange-400 group-focus-visible:ring-2 group-focus-visible:ring-[#ff5a00] group-focus-visible:ring-offset-2',
                thumbnailVariant === 'compact' ? 'h-14 w-14' : 'h-20 w-20',
              )}>
                <Image
                  src={photo.url}
                  alt={`${photo.label} - ${photo.stopLabel}`}
                  fill
                  className="object-cover transition duration-200 group-hover:scale-105"
                  sizes={thumbnailVariant === 'compact' ? '56px' : '80px'}
                  unoptimized
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-center font-mono text-[9px] font-bold uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
                  View
                </span>
              </span>
              {thumbnailVariant === 'detailed' ? (
                <span className="mt-1 block max-w-20 text-center">
                  <span className="block text-[10px] font-medium leading-tight text-slate-700">{photo.label}</span>
                  <span className="block truncate text-[10px] leading-tight text-muted-foreground">{photo.stopLabel}</span>
                </span>
              ) : null}
            </button>
          </Dialog.Trigger>
        ))}
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[101] flex h-[92vh] w-[calc(100vw-1rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#141110] text-white shadow-2xl focus:outline-none sm:w-[calc(100vw-2rem)]"
          aria-describedby={descriptionId}
        >
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1d1917] px-4 py-3 sm:flex-nowrap sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Dialog.Title className="truncate text-sm font-semibold text-white">
                  {currentPhoto.label} photo
                </Dialog.Title>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-orange-400">
                  {selectedIndex + 1} / {photos.length}
                </span>
              </div>
              <Dialog.Description id={descriptionId} className="truncate text-xs text-white/55">
                {currentPhoto.stopLabel}
              </Dialog.Description>
            </div>
            <div className="order-3 flex w-full shrink-0 items-center justify-center gap-1 rounded-md border border-white/10 bg-black/20 p-1 sm:order-none sm:w-auto">
              <GalleryControl
                label="Zoom out"
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
              >
                <Minus className="h-4 w-4" />
              </GalleryControl>
              <span className="w-12 text-center font-mono text-[10px] font-bold text-white/70" aria-live="polite">
                {zoomPercent}%
              </span>
              <GalleryControl
                label="Zoom in"
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
              >
                <Plus className="h-4 w-4" />
              </GalleryControl>
              <GalleryControl label="Reset zoom" onClick={resetTransform} disabled={zoom === MIN_ZOOM}>
                <RotateCcw className="h-4 w-4" />
              </GalleryControl>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Close photo gallery"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            <div
              className={cn(
                'relative h-full w-full overflow-hidden touch-none',
                zoom > MIN_ZOOM ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
              )}
              onDoubleClick={() => changeZoom(zoom === MIN_ZOOM ? 2 : MIN_ZOOM)}
              onWheel={event => {
                event.preventDefault()
                changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
              }}
              onPointerDown={event => {
                if (zoom === MIN_ZOOM) return
                event.currentTarget.setPointerCapture(event.pointerId)
                dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
              }}
              onPointerMove={event => {
                if (!dragStart.current || zoom === MIN_ZOOM) return
                setPan({
                  x: dragStart.current.panX + event.clientX - dragStart.current.x,
                  y: dragStart.current.panY + event.clientY - dragStart.current.y,
                })
              }}
              onPointerUp={() => { dragStart.current = null }}
              onPointerCancel={() => { dragStart.current = null }}
            >
              <Image
                key={currentPhoto.url}
                src={currentPhoto.url}
                alt={`${currentPhoto.label} - ${currentPhoto.stopLabel}`}
                fill
                className="select-none object-contain transition-transform duration-150 ease-out"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                sizes="100vw"
                draggable={false}
                unoptimized
                priority
              />
            </div>

            {photos.length > 1 ? (
              <>
                <GalleryArrow direction="previous" onClick={showPrevious} />
                <GalleryArrow direction="next" onClick={showNext} />
              </>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-[#1d1917] px-3 py-3">
            <div className="mx-auto flex max-w-full justify-center gap-2 overflow-x-auto pb-1">
              {photos.map((photo, index) => (
                <button
                  type="button"
                  key={`${photo.url}-thumbnail-${index}`}
                  onClick={() => showPhoto(index)}
                  className={cn(
                    'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                    selectedIndex === index ? 'border-[#ff5a00]' : 'border-transparent opacity-55 hover:opacity-100',
                  )}
                  aria-label={`Show ${photo.label} photo ${index + 1} of ${photos.length}`}
                  aria-current={selectedIndex === index ? 'true' : undefined}
                >
                  <Image src={photo.url} alt="" fill className="object-cover" sizes="56px" unoptimized />
                </button>
              ))}
            </div>
            <p className="mt-1 text-center text-[10px] text-white/45">
              Arrow keys browse · +/− zoom · drag to pan · double-click to zoom
            </p>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function GalleryControl({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

function GalleryArrow({ direction, onClick }: { direction: 'previous' | 'next'; onClick: () => void }) {
  const previous = direction === 'previous'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:border-orange-400 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
        previous ? 'left-3' : 'right-3',
      )}
      aria-label={`${previous ? 'Previous' : 'Next'} photo`}
    >
      {previous ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
    </button>
  )
}
