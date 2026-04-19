'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

type AdaptiveNewsThumbnailProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  initialAspect?: 'square' | 'video'
}

function getAspectFromDimensions(width: number, height: number) {
  const ratio = width / Math.max(1, height)
  return ratio >= 1.3 ? 'video' : 'square'
}

export function AdaptiveNewsThumbnail({
  src,
  alt,
  className,
  imageClassName,
  initialAspect = 'video',
}: AdaptiveNewsThumbnailProps) {
  const [aspect, setAspect] = useState<'square' | 'video'>(initialAspect)

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-slate-100 transition-all',
        aspect === 'square' ? 'aspect-square' : 'aspect-video',
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className={cn('object-cover', imageClassName)}
        onLoad={(event) => {
          const nextAspect = getAspectFromDimensions(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
          setAspect(current => (current === nextAspect ? current : nextAspect))
        }}
      />
    </div>
  )
}
