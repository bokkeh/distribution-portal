import Image from 'next/image'
import Link from 'next/link'
import { BellRing, ExternalLink, Newspaper, Sparkles, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getIndustryNewsSections, type IndustryNewsAudience, type IndustryNewsItem } from '@/lib/industry-news'

const audienceMeta: Record<IndustryNewsAudience, { title: string; description: string }> = {
  admin: {
    title: 'Industry News',
    description: 'Trade coverage, Wisher watch items, market intelligence, and operational alerts relevant to AHAWC leadership.',
  },
  staff: {
    title: 'Industry News',
    description: 'Operational and account-facing stories that affect order flow, communication, and follow-up.',
  },
  sales: {
    title: 'Industry News',
    description: 'Retail, on-premise, pricing, and category stories to support account conversations and sell-through.',
  },
  taster: {
    title: 'Industry News',
    description: 'Sampling, activation, bartender, and consumer-trend coverage to sharpen field execution.',
  },
  driver: {
    title: 'Industry News',
    description: 'Delivery, logistics, and route-impacting updates plus operational context that affects execution.',
  },
  customer: {
    title: 'Industry News',
    description: 'Buyer-facing market updates, category trends, and merchandising signals relevant to your account.',
  },
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`))
}

function StoryList({ stories }: { stories: IndustryNewsItem[] }) {
  if (stories.length === 0) {
    return <p className="text-sm text-slate-500">No stories are available for this section yet.</p>
  }

  return (
    <div className="space-y-3">
      {stories.map(story => (
        <div key={story.id} className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="relative h-52 w-full">
            <Image
              src={story.thumbnailUrl}
              alt={story.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={story.priority === 'high' ? 'warning' : story.priority === 'medium' ? 'info' : 'secondary'}>
              {story.priority} priority
            </Badge>
            <Badge variant="outline">{story.sourceName}</Badge>
            {story.isWisherRelevant ? <Badge variant="success">Wisher Watch</Badge> : null}
            {story.isAHAWCRelevant ? <Badge variant="info">AHAWC</Badge> : null}
            {story.isMarylandRelevant ? <Badge variant="outline">Maryland</Badge> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">{story.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{story.summary}</p>
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Why it matters:</span> {story.whyItMatters}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{formatPublishedDate(story.publishedAt)}</span>
              {story.tags.map(tag => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">
                  {tag}
                </span>
              ))}
            </div>
            <a
              href={story.articleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export async function IndustryNewsFeedPage({ audience }: { audience: IndustryNewsAudience }) {
  const sections = await getIndustryNewsSections(audience)
  const meta = audienceMeta[audience]

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Industry News</Badge>
              <Badge variant="outline">Role-aware feed</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{meta.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{meta.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Top stories</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{sections.topStories.length}</p>
                <p className="mt-1 text-xs text-slate-500">Prioritized for your role</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Wisher watch</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{sections.wisherWatch.length}</p>
                <p className="mt-1 text-xs text-slate-500">Brand-relevant stories</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Trend reports</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{sections.trendReports.length}</p>
                <p className="mt-1 text-xs text-slate-500">Consumer and category context</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/docs/INDUSTRY_NEWS_REQUIREMENTS.md">
                <Button variant="outline">Open Requirements</Button>
              </Link>
            </div>
          </div>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4 text-slate-400" />
                Feed notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Current mode</p>
                <p className="mt-1 text-xs text-slate-500">
                  Stories are pulled from configured industry publication sources, stored in the portal database, and grouped by role.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Next phase</p>
                <p className="mt-1 text-xs text-slate-500">
                  Mute controls, digests, and role-targeted notification delivery can layer onto this feed without changing the page structure.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="h-4 w-4 text-slate-400" />
              Top Stories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StoryList stories={sections.topStories} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-slate-400" />
                Wisher Watch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StoryList stories={sections.wisherWatch} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                Trend Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StoryList stories={sections.trendReports} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AHAWC Relevance</CardTitle>
        </CardHeader>
        <CardContent>
          <StoryList stories={sections.ahawcRelevant} />
        </CardContent>
      </Card>
    </div>
  )
}
