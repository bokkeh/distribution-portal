'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const FALLBACK_THUMBNAILS = [
  '/news/fallbacks/industry-news-1.svg',
  '/news/fallbacks/industry-news-2.svg',
  '/news/fallbacks/industry-news-3.svg',
  '/news/fallbacks/industry-news-4.svg',
] as const

type AdaptiveNewsThumbnailProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  initialAspect?: 'square' | 'video'
  adaptiveAspect?: boolean
  seed?: string
}

function getAspectFromDimensions(width: number, height: number) {
  const ratio = width / Math.max(1, height)
  return ratio >= 1.3 ? 'video' : 'square'
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function getFallbackThumbnail(seed: string) {
  return FALLBACK_THUMBNAILS[hashString(seed) % FALLBACK_THUMBNAILS.length]
}

export function AdaptiveNewsThumbnail({
  src,
  alt,
  className,
  imageClassName,
  initialAspect = 'video',
  adaptiveAspect = true,
  seed,
}: AdaptiveNewsThumbnailProps) {
  const [aspect, setAspect] = useState<'square' | 'video'>(initialAspect)
  const fallbackSrc = getFallbackThumbnail(seed ?? `${src}:${alt}`)
  const [currentSrc, setCurrentSrc] = useState(src)

  useEffect(() => {
    setCurrentSrc(src)
  }, [src])

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-slate-100 transition-all',
        adaptiveAspect ? (aspect === 'square' ? 'aspect-square' : 'aspect-video') : null,
        className
      )}
    >
      <Image
        src={currentSrc}
        alt={alt}
        fill
        unoptimized
        className={cn('object-cover', imageClassName)}
        onLoad={(event) => {
          if (!adaptiveAspect) return
          const nextAspect = getAspectFromDimensions(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
          setAspect(current => (current === nextAspect ? current : nextAspect))
        }}
        onError={() => {
          setCurrentSrc(current => (current === fallbackSrc ? current : fallbackSrc))
        }}
      />
    </div>
  )
}
