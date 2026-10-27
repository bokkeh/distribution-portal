'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { getFieldTastings } from '@/actions/field-tastings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatEasternDate, formatEasternTimeRange } from '@/lib/tastings/time'

type Result = Awaited<ReturnType<typeof getFieldTastings>>
type Period = 'upcoming' | 'past' | 'all'

export function FieldTastingsOverview() {
  const [request, setRequest] = useState({ period: 'upcoming' as Period, query: '', offset: 0 })
  const [rows, setRows] = useState<Result['rows']>([])
  const [page, setPage] = useState({ total: 0, nextOffset: 0, hasMore: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true); setError('')
      if (request.offset === 0) setRows([])
      try {
        const result = await getFieldTastings(request)
        if (!active) return
        setRows(previous => request.offset === 0 ? result.rows : [...new Map([...previous, ...result.rows].map(row => [row.id, row])).values()])
        setPage({ total: result.total, nextOffset: result.nextOffset, hasMore: result.hasMore })
      } catch {
        if (active) setError('Could not load tastings. Check your connection and retry.')
      } finally {
        if (active) setLoading(false)
      }
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [request])

  function filter(next: Partial<typeof request>) {
    setLoading(true)
    setRequest(previous => ({ ...previous, ...next, offset: 0 }))
  }

  return <div className="min-h-dvh bg-[#faf9f6] pb-[max(2rem,env(safe-area-inset-bottom))]">
    <header className="sticky top-0 z-20 bg-[#120f0e] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto max-w-2xl"><Link href="/field" className="inline-flex min-h-12 items-center gap-2 text-sm"><ArrowLeft className="size-5" />Back to Field notes</Link><h1 className="font-display text-3xl font-bold uppercase">Tastings overview</h1><p className="mt-1 text-sm text-stone-300">Across all accounts you have access to.</p></div>
    </header>
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="grid grid-cols-3 gap-2" aria-label="Tasting period">{(['upcoming', 'past', 'all'] as const).map(period => <Button key={period} variant={request.period === period ? 'default' : 'outline'} aria-pressed={request.period === period} className="h-12 capitalize" onClick={() => filter({ period })}>{period}</Button>)}</div>
      <label className="block text-sm font-medium">Search tastings<input type="search" value={request.query} maxLength={100} onChange={event => filter({ query: event.target.value })} placeholder="Account, tasting, taster or city…" className="mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base" /></label>
      <div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{loading ? 'Loading tastings…' : `${rows.length} of ${page.total} tastings`}</p><Button variant="outline" className="h-12" disabled={loading} onClick={() => filter({})}>Refresh tastings</Button></div>
      {error ? <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><Button variant="outline" className="h-12" onClick={() => { setLoading(true); setRequest(previous => ({ ...previous })) }}>Retry</Button></div> : null}
      {request.period === 'upcoming' ? <p className="text-xs text-muted-foreground">Requested, scheduled and confirmed tastings, including visits currently in progress. Choose All to include completed, cancelled and declined records.</p> : null}
      <div className="space-y-3">{rows.map(tasting => <article key={tasting.id} className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-lg font-bold">{tasting.accountName}</h2><Badge variant={tasting.status === 'completed' ? 'success' : tasting.status === 'cancelled' || tasting.status === 'declined' ? 'outline' : 'info'} className="capitalize">{tasting.status}</Badge></div>
        <p className="break-words text-sm">{tasting.eventName}</p>
        <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-5 shrink-0 text-[#ff5a00]" /><div><p className="font-semibold">{formatEasternDate(tasting.start, tasting.timeZone)}</p><p className="text-sm">{formatEasternTimeRange(tasting.start, tasting.end, tasting.timeZone)}</p></div></div>
        <p className="text-sm"><span className="text-muted-foreground">Taster: </span>{tasting.assignee}</p>
        {[tasting.address, tasting.city, tasting.state].some(Boolean) ? <p className="break-words text-sm text-muted-foreground">{[tasting.address, tasting.city, tasting.state].filter(Boolean).join(', ')}</p> : null}
      </article>)}</div>
      {!loading && !error && !rows.length ? <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">No tastings match these filters.</p> : null}
      {page.hasMore && !error ? <Button variant="outline" className="h-14 w-full" disabled={loading} onClick={() => { setLoading(true); setRequest(previous => ({ ...previous, offset: page.nextOffset })) }}>Show more tastings</Button> : null}
    </main>
  </div>
}
