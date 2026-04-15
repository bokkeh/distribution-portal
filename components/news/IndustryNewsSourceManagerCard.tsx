'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { syncIndustryNewsNow, toggleIndustryNewsSource } from '@/actions/industry-news'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SourceRow = {
  id: string
  name: string
  homepageUrl: string
  feedUrl: string | null
  sourceTier: string
  active: boolean
  lastSyncedAt: Date | null
  lastError: string | null
  itemCount: number
}

function formatDate(value: Date | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function ToggleSourceButton({ sourceId, active }: { sourceId: string; active: boolean }) {
  const [state, action, pending] = useActionState(toggleIndustryNewsSource, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to update source', { description: state.error })
    }
  }, [state])

  return (
    <form action={action}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="active" value={String(!active)} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Saving...' : active ? 'Disable' : 'Enable'}
      </Button>
    </form>
  )
}

export function IndustryNewsSourceManagerCard({ sources }: { sources: SourceRow[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">Source Manager</CardTitle>
        <form action={syncIndustryNewsNow}>
          <Button type="submit" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Now
          </Button>
        </form>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="rounded-2xl border border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{source.name}</p>
                  <Badge variant={source.active ? 'success' : 'secondary'}>{source.active ? 'active' : 'disabled'}</Badge>
                  <Badge variant="outline">{source.sourceTier.replace('_', ' ')}</Badge>
                  <Badge variant="outline">{source.itemCount} items</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  <a href={source.homepageUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {source.homepageUrl}
                  </a>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Feed: {source.feedUrl ?? 'Not discovered yet'} · Last sync: {formatDate(source.lastSyncedAt)}
                </div>
                {source.lastError ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    {source.lastError}
                  </p>
                ) : null}
              </div>
              <ToggleSourceButton sourceId={source.id} active={source.active} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
