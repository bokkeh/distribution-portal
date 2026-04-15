import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { industryNewsItems, industryNewsSources } from '@/db/schema'

export type IndustryNewsAudience = 'admin' | 'staff' | 'sales' | 'taster' | 'driver' | 'customer'
export type IndustryNewsCategory =
  | 'breaking_news'
  | 'brand_mention'
  | 'trend_report'
  | 'consumer_report'
  | 'distribution_alert'
  | 'retail_insight'
  | 'on_premise_insight'
  | 'operations_alert'

export type IndustryNewsItem = {
  id: string
  title: string
  summary: string
  sourceName: string
  sourceUrl: string
  articleUrl: string
  thumbnailUrl: string
  publishedAt: string
  category: IndustryNewsCategory
  priority: 'high' | 'medium' | 'low'
  roleTargets: IndustryNewsAudience[]
  tags: string[]
  whyItMatters: string
  actionLabel?: string
  isWisherRelevant?: boolean
  isAHAWCRelevant?: boolean
  isMarylandRelevant?: boolean
}

export type IndustryNewsPreview = {
  title: string
  body: string
  href: string
  imageUrl: string
}

type SourceSeed = {
  name: string
  homepageUrl: string
  sourceTier: string
  defaultRoleTargets: IndustryNewsAudience[]
}

type ParsedFeedItem = {
  articleUrl: string
  title: string
  summary: string
  publishedAt: Date | null
  thumbnailUrl: string | null
}

const SOURCE_SEEDS: SourceSeed[] = [
  { name: 'Shanken News Daily', homepageUrl: 'https://www.shankennewsdaily.com/', sourceTier: 'tier_1', defaultRoleTargets: ['admin', 'staff', 'sales'] },
  { name: 'Market Watch Magazine', homepageUrl: 'https://www.marketwatchmag.com/', sourceTier: 'tier_1', defaultRoleTargets: ['admin', 'sales', 'customer'] },
  { name: 'SevenFifty Daily', homepageUrl: 'https://daily.sevenfifty.com/', sourceTier: 'tier_1', defaultRoleTargets: ['admin', 'staff', 'sales', 'taster'] },
  { name: 'Just Drinks', homepageUrl: 'https://www.just-drinks.com/', sourceTier: 'tier_1', defaultRoleTargets: ['admin', 'staff'] },
  { name: 'The Spirits Business', homepageUrl: 'https://www.thespiritsbusiness.com/', sourceTier: 'tier_2', defaultRoleTargets: ['admin', 'sales', 'taster'] },
  { name: 'The Drinks Business', homepageUrl: 'https://www.thedrinksbusiness.com/', sourceTier: 'tier_2', defaultRoleTargets: ['admin', 'sales'] },
  { name: 'Drinks International', homepageUrl: 'https://drinksint.com/', sourceTier: 'tier_2', defaultRoleTargets: ['admin', 'sales', 'taster'] },
  { name: 'Chilled Magazine', homepageUrl: 'https://chilledmagazine.com/', sourceTier: 'tier_2', defaultRoleTargets: ['sales', 'taster'] },
  { name: 'Imbibe Magazine', homepageUrl: 'https://imbibemagazine.com/', sourceTier: 'tier_2', defaultRoleTargets: ['sales', 'taster'] },
  { name: 'BevNET', homepageUrl: 'https://www.bevnet.com/', sourceTier: 'tier_3', defaultRoleTargets: ['admin', 'sales', 'customer'] },
  { name: 'Beverage Industry Magazine', homepageUrl: 'https://www.bevindustry.com/', sourceTier: 'tier_3', defaultRoleTargets: ['admin', 'staff', 'sales'] },
  { name: 'Beverage Daily', homepageUrl: 'https://www.beveragedaily.com/', sourceTier: 'tier_3', defaultRoleTargets: ['admin', 'sales'] },
  { name: 'Cheers Magazine', homepageUrl: 'https://www.cheersonline.com/', sourceTier: 'tier_4', defaultRoleTargets: ['admin', 'sales', 'taster'] },
  { name: 'StateWays', homepageUrl: 'https://stateways.com/', sourceTier: 'tier_4', defaultRoleTargets: ['admin', 'sales'] },
  { name: 'Beverage Dynamics', homepageUrl: 'https://beveragedynamics.com/', sourceTier: 'tier_4', defaultRoleTargets: ['admin', 'sales', 'customer'] },
  { name: 'The Beverage Journal', homepageUrl: 'https://www.thebeveragejournal.com/', sourceTier: 'tier_4', defaultRoleTargets: ['admin', 'staff', 'driver'] },
]

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000
const MAX_ITEMS_PER_SOURCE = 8
const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80'

const audienceHref: Record<IndustryNewsAudience, string> = {
  admin: '/admin/news',
  staff: '/staff/news',
  sales: '/sales/news',
  taster: '/taster/news',
  driver: '/driver/news',
  customer: '/customer/news',
}

function stripHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTagValue(block: string, tag: string) {
  const direct = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
  if (direct?.[1]) return stripHtml(direct[1])
  return null
}

function getAttributeValue(block: string, tag: string, attribute: string) {
  const match = new RegExp(`<${tag}[^>]*${attribute}=["']([^"']+)["'][^>]*>`, 'i').exec(block)
  return match?.[1] ?? null
}

function absolutizeUrl(value: string | null, baseUrl: string) {
  if (!value) return null
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

function findThumbnail(block: string, baseUrl: string) {
  const candidates = [
    getAttributeValue(block, 'media:content', 'url'),
    getAttributeValue(block, 'media:thumbnail', 'url'),
    getAttributeValue(block, 'enclosure', 'url'),
    /<img[^>]+src=["']([^"']+)["']/i.exec(block)?.[1] ?? null,
  ]

  for (const candidate of candidates) {
    const url = absolutizeUrl(candidate, baseUrl)
    if (url && /\.(avif|gif|jpe?g|png|webp|svg)(\?|$)/i.test(url)) return url
  }

  return null
}

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseRssItems(xml: string, baseUrl: string) {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => match[0])
  return blocks
    .map<ParsedFeedItem | null>(block => {
      const articleUrl = absolutizeUrl(getTagValue(block, 'link'), baseUrl)
      const title = getTagValue(block, 'title')
      if (!articleUrl || !title) return null
      const summary = getTagValue(block, 'description') ?? getTagValue(block, 'content:encoded') ?? ''
      return {
        articleUrl,
        title,
        summary,
        publishedAt: parseDate(getTagValue(block, 'pubDate') ?? getTagValue(block, 'dc:date')),
        thumbnailUrl: findThumbnail(block, baseUrl),
      }
    })
    .filter((item): item is ParsedFeedItem => Boolean(item))
}

function parseAtomItems(xml: string, baseUrl: string) {
  const blocks = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(match => match[0])
  return blocks
    .map<ParsedFeedItem | null>(block => {
      const title = getTagValue(block, 'title')
      const articleUrl =
        absolutizeUrl(getAttributeValue(block, 'link', 'href'), baseUrl) ??
        absolutizeUrl(getTagValue(block, 'id'), baseUrl)
      if (!articleUrl || !title) return null
      const summary = getTagValue(block, 'summary') ?? getTagValue(block, 'content') ?? ''
      return {
        articleUrl,
        title,
        summary,
        publishedAt: parseDate(getTagValue(block, 'updated') ?? getTagValue(block, 'published')),
        thumbnailUrl: findThumbnail(block, baseUrl),
      }
    })
    .filter((item): item is ParsedFeedItem => Boolean(item))
}

function parseFeed(xml: string, baseUrl: string) {
  if (/<rss[\s>]/i.test(xml) || /<channel[\s>]/i.test(xml)) {
    return parseRssItems(xml, baseUrl)
  }
  if (/<feed[\s>]/i.test(xml)) {
    return parseAtomItems(xml, baseUrl)
  }
  return []
}

function discoverFeedUrl(html: string, baseUrl: string) {
  const alternateLinks = [...html.matchAll(/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]*>/gi)].map(match => match[0])

  for (const link of alternateLinks) {
    if (!/application\/(rss\+xml|atom\+xml|xml)/i.test(link)) continue
    const href = /href=["']([^"']+)["']/i.exec(link)?.[1] ?? null
    const url = absolutizeUrl(href, baseUrl)
    if (url) return url
  }

  return null
}

function scoreItem(sourceName: string, title: string, summary: string, defaultRoleTargets: IndustryNewsAudience[]) {
  const haystack = `${title} ${summary} ${sourceName}`.toLowerCase()
  const has = (...terms: string[]) => terms.some(term => haystack.includes(term))
  const tags = new Set<string>()

  if (has('wisher')) tags.add('wisher')
  if (has('vodka')) tags.add('vodka')
  if (has('retail', 'independent retailers', 'merchandising', 'shelf')) tags.add('retail')
  if (has('distribution', 'distributor', 'supplier')) tags.add('distribution')
  if (has('menu', 'bar', 'bartender', 'on-premise', 'cocktail', 'restaurant')) tags.add('on-premise')
  if (has('consumer', 'shopper', 'premiumization', 'trend', 'survey')) tags.add('consumer trends')
  if (has('delivery', 'freight', 'weather', 'route', 'logistics')) tags.add('operations')
  if (has('maryland', 'mid-atlantic', 'annapolis', 'baltimore')) tags.add('maryland')

  const isWisherRelevant = has('wisher', 'vodka')
  const isAHAWCRelevant = isWisherRelevant || has('distribution', 'retail', 'supplier', 'merchandising', 'delivery')
  const isMarylandRelevant = has('maryland', 'mid-atlantic', 'annapolis', 'baltimore')

  const category: IndustryNewsCategory =
    has('delivery', 'weather', 'route', 'freight', 'logistics')
      ? 'operations_alert'
      : has('retail', 'shelf', 'display', 'merchandising')
        ? 'retail_insight'
        : has('menu', 'bar', 'bartender', 'cocktail', 'restaurant')
          ? 'on_premise_insight'
          : has('consumer', 'trend', 'report', 'survey')
            ? 'consumer_report'
            : isWisherRelevant
              ? 'brand_mention'
              : has('distribution', 'supplier', 'distributor')
                ? 'distribution_alert'
                : 'breaking_news'

  const priority: 'high' | 'medium' | 'low' =
    category === 'operations_alert' || has('urgent', 'disruption', 'warning') || (isWisherRelevant && has('launch', 'distribution', 'placement'))
      ? 'high'
      : isAHAWCRelevant || category === 'distribution_alert' || category === 'retail_insight'
        ? 'medium'
        : 'low'

  const whyItMatters =
    category === 'operations_alert'
      ? 'This affects delivery execution, ETA management, and account communication in the field.'
      : category === 'retail_insight'
        ? 'This helps sales conversations around shelf placement, signage, and account-level merchandising support.'
        : category === 'on_premise_insight'
          ? 'This is relevant for bar and restaurant positioning, tasting scripts, and menu conversations.'
          : isWisherRelevant
            ? 'This is directly relevant to Wisher Vodka positioning and should inform current account conversations.'
            : 'This provides market context that can sharpen planning, account follow-up, and brand positioning.'

  const actionLabel =
    category === 'operations_alert'
      ? 'Review operational impact'
      : category === 'retail_insight'
        ? 'Use in account planning'
        : category === 'on_premise_insight'
          ? 'Apply in on-premise outreach'
          : isWisherRelevant
            ? 'Review Wisher relevance'
            : 'Review story'

  const roleTargets = new Set<IndustryNewsAudience>(defaultRoleTargets)
  if (category === 'operations_alert') {
    roleTargets.add('driver')
    roleTargets.add('staff')
    roleTargets.add('admin')
  }
  if (category === 'retail_insight' || category === 'distribution_alert') {
    roleTargets.add('sales')
    roleTargets.add('admin')
  }
  if (category === 'on_premise_insight' || category === 'consumer_report') {
    roleTargets.add('taster')
    roleTargets.add('sales')
  }

  return {
    tags: Array.from(tags),
    category,
    priority,
    roleTargets: Array.from(roleTargets),
    whyItMatters,
    actionLabel,
    isWisherRelevant,
    isAHAWCRelevant,
    isMarylandRelevant,
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'AHAWC-Portal-NewsBot/1.0 (+https://ahawc.com)',
      accept: 'text/html,application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

async function ensureDefaultIndustryNewsSources() {
  const existing = await db.select().from(industryNewsSources)
  const byHomepage = new Map(existing.map(source => [source.homepageUrl, source]))
  const missing = SOURCE_SEEDS.filter(source => !byHomepage.has(source.homepageUrl))

  if (!missing.length) return

  await db.insert(industryNewsSources).values(
    missing.map(source => ({
      name: source.name,
      homepageUrl: source.homepageUrl,
      sourceTier: source.sourceTier,
      defaultRoleTargets: source.defaultRoleTargets,
    }))
  )
}

export async function syncIndustryNews(force = false) {
  await ensureDefaultIndustryNewsSources()
  const sources = await db.select().from(industryNewsSources).where(eq(industryNewsSources.active, true))
  const now = Date.now()

  await Promise.allSettled(
    sources.map(async source => {
      if (!force && source.lastSyncedAt && now - new Date(source.lastSyncedAt).getTime() < SYNC_INTERVAL_MS) {
        return
      }

      try {
        const homepageHtml = await fetchText(source.homepageUrl)
        const discoveredFeedUrl = source.feedUrl ?? discoverFeedUrl(homepageHtml, source.homepageUrl)

        if (!discoveredFeedUrl) {
          await db
            .update(industryNewsSources)
            .set({
              lastSyncedAt: new Date(),
              lastError: 'No RSS or Atom feed discovered on source homepage.',
              updatedAt: new Date(),
            })
            .where(eq(industryNewsSources.id, source.id))
          return
        }

        const xml = await fetchText(discoveredFeedUrl)
        const parsedItems = parseFeed(xml, discoveredFeedUrl).slice(0, MAX_ITEMS_PER_SOURCE)

        await db
          .update(industryNewsSources)
          .set({
            feedUrl: discoveredFeedUrl,
            lastSyncedAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(industryNewsSources.id, source.id))

        for (const item of parsedItems) {
          const scoring = scoreItem(
            source.name,
            item.title,
            item.summary,
            (source.defaultRoleTargets as IndustryNewsAudience[]) ?? ['admin']
          )

          await db
            .insert(industryNewsItems)
            .values({
              sourceId: source.id,
              sourceName: source.name,
              sourceUrl: source.homepageUrl,
              articleUrl: item.articleUrl,
              title: item.title,
              summary: item.summary,
              thumbnailUrl: item.thumbnailUrl ?? FALLBACK_THUMBNAIL,
              publishedAt: item.publishedAt,
              fetchedAt: new Date(),
              category: scoring.category,
              priority: scoring.priority,
              roleTargets: scoring.roleTargets,
              tags: scoring.tags,
              whyItMatters: scoring.whyItMatters,
              actionLabel: scoring.actionLabel,
              isWisherRelevant: scoring.isWisherRelevant,
              isAHAWCRelevant: scoring.isAHAWCRelevant,
              isMarylandRelevant: scoring.isMarylandRelevant,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: industryNewsItems.articleUrl,
              set: {
                sourceId: source.id,
                sourceName: source.name,
                sourceUrl: source.homepageUrl,
                title: item.title,
                summary: item.summary,
                thumbnailUrl: item.thumbnailUrl ?? FALLBACK_THUMBNAIL,
                publishedAt: item.publishedAt,
                fetchedAt: new Date(),
                category: scoring.category,
                priority: scoring.priority,
                roleTargets: scoring.roleTargets,
                tags: scoring.tags,
                whyItMatters: scoring.whyItMatters,
                actionLabel: scoring.actionLabel,
                isWisherRelevant: scoring.isWisherRelevant,
                isAHAWCRelevant: scoring.isAHAWCRelevant,
                isMarylandRelevant: scoring.isMarylandRelevant,
                updatedAt: new Date(),
              },
            })
        }
      } catch (error) {
        await db
          .update(industryNewsSources)
          .set({
            lastSyncedAt: new Date(),
            lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown sync failure',
            updatedAt: new Date(),
          })
          .where(eq(industryNewsSources.id, source.id))
      }
    })
  )
}

async function syncIfStale() {
  await ensureDefaultIndustryNewsSources()
  const sources = await db.select().from(industryNewsSources).where(eq(industryNewsSources.active, true))
  const hasStaleSource = sources.some(
    source => !source.lastSyncedAt || Date.now() - new Date(source.lastSyncedAt).getTime() >= SYNC_INTERVAL_MS
  )
  const itemCount = await db.$count(industryNewsItems)

  if (itemCount === 0 || hasStaleSource) {
    await syncIndustryNews(itemCount === 0)
  }
}

function priorityValue(priority: string) {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
}

function toClientItem(row: typeof industryNewsItems.$inferSelect): IndustryNewsItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    articleUrl: row.articleUrl,
    thumbnailUrl: row.thumbnailUrl ?? FALLBACK_THUMBNAIL,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString().slice(0, 10),
    category: row.category as IndustryNewsCategory,
    priority: row.priority as 'high' | 'medium' | 'low',
    roleTargets: (row.roleTargets as IndustryNewsAudience[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    whyItMatters: row.whyItMatters,
    actionLabel: row.actionLabel ?? undefined,
    isWisherRelevant: row.isWisherRelevant,
    isAHAWCRelevant: row.isAHAWCRelevant,
    isMarylandRelevant: row.isMarylandRelevant,
  }
}

export async function getIndustryNewsForAudience(audience: IndustryNewsAudience) {
  await syncIfStale()

  const rows = await db
    .select()
    .from(industryNewsItems)
    .orderBy(desc(industryNewsItems.publishedAt), desc(industryNewsItems.createdAt))
    .limit(120)

  return rows
    .map(toClientItem)
    .filter(item => item.roleTargets.includes(audience))
    .sort((left, right) => {
      const priorityDiff = priorityValue(right.priority) - priorityValue(left.priority)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    })
}

export async function getIndustryNewsHighlights(audience: IndustryNewsAudience, limit = 4) {
  return (await getIndustryNewsForAudience(audience)).slice(0, limit)
}

export async function getIndustryNewsSections(audience: IndustryNewsAudience) {
  const stories = await getIndustryNewsForAudience(audience)
  return {
    topStories: stories.slice(0, 4),
    wisherWatch: stories.filter(item => item.isWisherRelevant).slice(0, 4),
    ahawcRelevant: stories.filter(item => item.isAHAWCRelevant || item.isMarylandRelevant).slice(0, 4),
    trendReports: stories
      .filter(item => item.category === 'trend_report' || item.category === 'consumer_report')
      .slice(0, 4),
  }
}

export function getIndustryNewsNotificationPreview(item: IndustryNewsItem, audience: IndustryNewsAudience): IndustryNewsPreview {
  return {
    title: item.title,
    body: item.summary,
    href: audienceHref[audience],
    imageUrl: item.thumbnailUrl,
  }
}

export function getIndustryNewsEmailCardHtml(item: IndustryNewsItem) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin: 0 0 16px;">
      <tr>
        <td style="padding: 0;">
          <img src="${item.thumbnailUrl}" alt="${item.title}" style="display: block; width: 100%; height: auto; max-height: 220px; object-fit: cover;" />
        </td>
      </tr>
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">${item.sourceName} - ${item.publishedAt}</p>
          <p style="margin: 0 0 10px; font-size: 18px; font-weight: 700; color: #0f172a;">${item.title}</p>
          <p style="margin: 0 0 12px; font-size: 14px; color: #475569;">${item.summary}</p>
          <p style="margin: 0; font-size: 13px; color: #0f172a;"><strong>Why it matters:</strong> ${item.whyItMatters}</p>
        </td>
      </tr>
    </table>
  `.trim()
}
