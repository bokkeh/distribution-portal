'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2 } from 'lucide-react'
import { geocodeAccountsBatch } from '@/actions/regions-map'

export function GeocodeButton({ missingCount }: { missingCount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ geocoded: number; failed: number } | null>(null)

  if (missingCount === 0) return null

  async function handleGeocode() {
    setLoading(true)
    setResult(null)
    try {
      const res = await geocodeAccountsBatch()
      setResult(res)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleGeocode}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
        )}
        {loading
          ? 'Geocoding…'
          : `Geocode ${missingCount} missing address${missingCount !== 1 ? 'es' : ''}`}
      </button>
      {result && (
        <p className="text-xs text-slate-500">
          ✓ {result.geocoded} geocoded
          {result.failed > 0 ? `, ${result.failed} failed` : ''}
        </p>
      )}
    </div>
  )
}
