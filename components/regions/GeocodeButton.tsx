'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { geocodeAccountsBatch } from '@/actions/regions-map'

export function GeocodeButton({ missingCount }: { missingCount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ geocoded: number; failed: number; error?: string } | null>(null)

  if (missingCount === 0) return null

  async function handleGeocode() {
    const confirmed = window.confirm(
      `This will send up to ${missingCount} billable Google Geocoding API request${missingCount === 1 ? '' : 's'} for missing account addresses. Continue?`
    )
    if (!confirmed) return

    setLoading(true)
    setResult(null)
    try {
      const res = await geocodeAccountsBatch()
      if (res.error) {
        toast.error('Batch geocode blocked', { description: res.error })
      }
      setResult(res)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="space-y-1">
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
            ? 'Geocoding...'
            : `Geocode ${missingCount} missing address${missingCount !== 1 ? 'es' : ''}`}
        </button>
        <p className="text-[11px] font-medium text-red-600">
          Warning: this triggers billable Google Geocoding API requests.
        </p>
      </div>
      {result && (
        <p className="text-xs text-slate-500">
          {result.error
            ? result.error
            : `OK ${result.geocoded} geocoded${result.failed > 0 ? `, ${result.failed} failed` : ''}`}
        </p>
      )}
    </div>
  )
}
