import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BellRing, Building2, Newspaper, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getIndustryNewsHighlights, type IndustryNewsAudience } from '@/lib/industry-news'

const audienceHref: Record<IndustryNewsAudience, string> = {
  admin: '/admin/news',
  staff: '/staff/news',
  sales: '/sales/news',
  taster: '/taster/news',
  driver: '/driver/news',
  customer: '/customer/news',
}

const audienceLabel: Record<IndustryNewsAudience, string> = {
  admin: 'Executive briefing',
  staff: 'Operations briefing',
  sales: 'Sales briefing',
  taster: 'Field activation briefing',
  driver: 'Route and operations briefing',
  customer: 'Buyer briefing',
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`))
}

export function IndustryNewsWidget({
  audience,
  title = 'Industry News',
}: {
  audience: IndustryNewsAudience
  title?: string
}) {
  const stories = getIndustryNewsHighlights(audience, 4)
  const href = audienceHref[audience]

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4 text-slate-400" />
            {title}
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">{audienceLabel[audience]}</p>
        </div>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          Open feed
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {stories.map(story => (
          <Link
            key={story.id}
            href={href}
            className="block overflow-hidden rounded-2xl border border-slate-200 transition-colors hover:bg-slate-50"
          >
            <div className="grid gap-0 sm:grid-cols-[112px_minmax(0,1fr)]">
              <div className="relative h-36 sm:h-full">
                <Image
                  src={story.thumbnailUrl}
                  alt={story.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={story.priority === 'high' ? 'warning' : story.priority === 'medium' ? 'info' : 'secondary'}>
                    {story.priority} priority
                  </Badge>
                  {story.isWisherRelevant ? <Badge variant="success">Wisher</Badge> : null}
                  {story.isAHAWCRelevant ? <Badge variant="outline">AHAWC</Badge> : null}
                </div>
                <p className="mt-2 font-medium text-slate-900">{story.title}</p>
                <p className="mt-1 text-xs text-slate-500">{story.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>{story.sourceName}</span>
                  <span>{formatPublishedDate(story.publishedAt)}</span>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
            </div>
            </div>
          </Link>
        ))}

        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-900">Trend reports</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Track consumer movement, merchandising shifts, and category direction.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-900">Role targeting</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">This feed is trimmed to the stories most relevant to your portal role.</p>
          </div>
        </div>

        {audience === 'admin' ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-slate-900">Admin note</p>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Use this as the review surface until live source ingestion and notification preferences are fully wired in.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
