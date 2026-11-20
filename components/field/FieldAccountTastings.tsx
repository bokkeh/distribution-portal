'use client'

import { useEffect, useRef, useState } from 'react'
import { getFieldAccountTastings, cancelFieldTasting } from '@/actions/field-data'
import { formatEasternDateWithWeekday, formatEasternTimeRange } from '@/lib/tastings/time'
import { Button } from '@/components/ui/button'

type History = Awaited<ReturnType<typeof getFieldAccountTastings>>
type Tasting = History['upcoming'][number]

function TastingRow({ tasting, canCancel, onCancelled }: { tasting: Tasting; canCancel?: boolean; onCancelled?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  return <div className="space-y-1 rounded-xl border bg-stone-50 p-3">
    <p className="font-semibold">{formatEasternDateWithWeekday(tasting.start, tasting.timeZone)} {'·'} {formatEasternTimeRange(tasting.start, tasting.end, tasting.timeZone)}</p>
    <p className="break-words text-sm">{tasting.assignee} {'·'} <span className="capitalize">{tasting.status}</span></p>
    <p className="break-words text-sm text-muted-foreground">{tasting.eventName}</p>
    {[tasting.address, tasting.city, tasting.state].some(Boolean) ? <p className="break-words text-sm text-muted-foreground">{[tasting.address, tasting.city, tasting.state].filter(Boolean).join(', ')}</p> : null}
    {canCancel && !confirming ? <Button type="button" variant="outline" size="sm" className="mt-2 text-red-700 border-red-200" onClick={() => setConfirming(true)}>Cancel tasting</Button> : null}
    {confirming ? <div className="mt-2 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-medium text-red-800">Cancel this tasting?</p>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={async () => {
          if (locked.current) return; locked.current = true; setPending(true); setError('')
          try { const result = await cancelFieldTasting(tasting.id); if ('error' in result) setError(result.error); else { setConfirming(false); onCancelled?.() } }
          catch { setError('Could not cancel. Retry.') }
          finally { locked.current = false; setPending(false) }
        }}>{pending ? 'Cancelling…' : 'Confirm cancel'}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>Back</Button>
      </div>
    </div> : null}
  </div>
}

export function FieldAccountTastings({ accountId, revision = 0, canCancel = false }: { accountId: string; revision?: number; canCancel?: boolean }) {
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0), [showCount, setShowCount] = useState(5)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try { const result = await getFieldAccountTastings(accountId); if (active) setHistory(result) }
      catch { if (active) setError('Could not refresh this account’s tastings. Check your connection and retry before booking.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [accountId, revision, refresh])
  return <section aria-label="Account tastings" className="space-y-4 rounded-2xl border bg-white p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">This account&apos;s tastings</h2><Button type="button" variant="outline" className="h-12" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh tastings</Button></div>
    <p className="text-sm text-muted-foreground">Check the gap between visits before booking. All account locations are included; times use each venue&apos;s timezone.</p>
    {loading ? <p role="status" className="text-sm">{history ? 'Refreshing tastings…' : 'Loading tastings…'}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}{history ? ' Dates below are from the last successful refresh.' : ''}</p> : null}
    {history ? <>
      <div className="space-y-2"><h3 className="font-semibold">Last tasting</h3>{history.last ? <><TastingRow tasting={history.last} />{history.last.status !== 'completed' ? <p className="text-xs text-muted-foreground">Past booking; completion has not been recorded.</p> : null}</> : <p className="text-sm text-muted-foreground">No past tasting recorded.</p>}</div>
      <div className="space-y-2"><h3 className="font-semibold">Upcoming & requested tastings ({history.upcoming.length})</h3>{history.upcoming.length ? history.upcoming.slice(0, showCount).map(tasting => <TastingRow key={tasting.id} tasting={tasting} canCancel={canCancel} onCancelled={() => setRefresh(value => value + 1)} />) : <p className="text-sm text-muted-foreground">No upcoming tastings recorded.</p>}
        {history.upcoming.length > showCount ? <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setShowCount(count => count + 10)}>Show more tastings ({history.upcoming.length - showCount} remaining)</Button> : null}
      </div>
      <p className="text-xs text-muted-foreground">Cancelled and declined tastings are excluded. Requested visits are shown so they aren&apos;t booked again.</p>
    </> : null}
  </section>
}
