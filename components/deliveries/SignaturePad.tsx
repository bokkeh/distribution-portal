'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function SignaturePad({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2
    context.strokeStyle = '#0f172a'

    if (value) {
      const image = new Image()
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
      }
      image.src = value
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [value])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function begin(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const point = getPoint(event)
    if (!canvas || !context || !point) return
    setDrawing(true)
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled) return
    const context = canvasRef.current?.getContext('2d')
    const point = getPoint(event)
    if (!context || !point) return
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function finish() {
    if (!drawing) return
    setDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={560}
        height={180}
        className="h-40 w-full touch-none rounded-xl border border-slate-300 bg-white"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerLeave={finish}
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled}>
          Clear Signature
        </Button>
      </div>
    </div>
  )
}
