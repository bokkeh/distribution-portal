export type IndustryNewsAudience =
  | 'admin'
  | 'staff'
  | 'sales'
  | 'taster'
  | 'driver'
  | 'customer'

export type IndustryNewsItem = {
  id: string
  title: string
  summary: string
  sourceName: string
  sourceUrl: string
  thumbnailUrl: string
  publishedAt: string
  category:
    | 'breaking_news'
    | 'brand_mention'
    | 'trend_report'
    | 'consumer_report'
    | 'distribution_alert'
    | 'retail_insight'
    | 'on_premise_insight'
    | 'operations_alert'
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

const INDUSTRY_NEWS_ITEMS: IndustryNewsItem[] = [
  {
    id: 'wisher-premium-vodka-positioning',
    title: 'Premium vodka shelf resets keep favoring story-led brands in independents',
    summary:
      'Retail buyers are leaning into premium shelf sets that pair a clear founder story with local activation support and high-visibility signage.',
    sourceName: 'Market Watch Magazine',
    sourceUrl: 'https://www.marketwatchmag.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-13',
    category: 'trend_report',
    priority: 'high',
    roleTargets: ['admin', 'staff', 'sales', 'customer'],
    tags: ['vodka', 'retail', 'pricing', 'independent stores'],
    whyItMatters:
      'This directly supports Wisher shelf-placement conversations and reinforces why account-specific signage and tastings matter.',
    actionLabel: 'Use in buyer conversations',
    isWisherRelevant: true,
    isAHAWCRelevant: true,
  },
  {
    id: 'maryland-on-premise-spring-trends',
    title: 'Maryland on-premise spring cocktail menus are shifting toward cleaner vodka builds',
    summary:
      'Regional bar programs are favoring lighter, premium vodka serves with simpler ingredient decks and higher-margin upsell potential.',
    sourceName: 'Cheers Magazine',
    sourceUrl: 'https://www.cheersonline.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-12',
    category: 'on_premise_insight',
    priority: 'medium',
    roleTargets: ['admin', 'sales', 'taster'],
    tags: ['maryland', 'bars', 'menu trends', 'vodka'],
    whyItMatters:
      'Sales reps can position Wisher as a fit for spring cocktail lists, while tastings can emphasize clean, premium cocktail applications.',
    actionLabel: 'Prioritize bar placements',
    isWisherRelevant: true,
    isMarylandRelevant: true,
  },
  {
    id: 'supplier-distributor-margin-pressure',
    title: 'Distributor margin pressure is pushing suppliers to prove store-level velocity faster',
    summary:
      'Trade reporting continues to show tighter expectations around proof of performance, especially for emerging spirit brands.',
    sourceName: 'Shanken News Daily',
    sourceUrl: 'https://www.shankennewsdaily.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-11',
    category: 'breaking_news',
    priority: 'high',
    roleTargets: ['admin', 'staff', 'sales'],
    tags: ['distribution', 'velocity', 'supplier strategy'],
    whyItMatters:
      'AHAWC needs tighter feedback loops between tastings, store photos, orders, and rep follow-up to protect distribution conversations.',
    actionLabel: 'Tighten follow-up cadence',
    isAHAWCRelevant: true,
  },
  {
    id: 'consumer-premiumization-rtd-crossovers',
    title: 'Consumer reports show premium spirits buyers still cross-shopping RTDs before trading up',
    summary:
      'Buyers continue entering the category through convenience-led RTD purchases, then moving into premium base spirits if merchandising is strong.',
    sourceName: 'BevNET',
    sourceUrl: 'https://www.bevnet.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-10',
    category: 'consumer_report',
    priority: 'medium',
    roleTargets: ['admin', 'sales', 'taster', 'customer'],
    tags: ['consumer trends', 'premiumization', 'RTD', 'merchandising'],
    whyItMatters:
      'This is useful context for shelf talkers, barker cards, and tasting scripts that bridge convenience buyers toward premium vodka.',
    actionLabel: 'Refresh merchandising pitch',
    isWisherRelevant: true,
  },
  {
    id: 'tasting-conversion-best-practices',
    title: 'Sampling teams seeing higher conversion when they log objections and display conditions immediately',
    summary:
      'Field teams that combine tasting notes with same-day shelf photos and placement feedback are improving close-the-loop sell-through.',
    sourceName: 'SevenFifty Daily',
    sourceUrl: 'https://daily.sevenfifty.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1567696911980-2c5c0cf6cbd4?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-09',
    category: 'trend_report',
    priority: 'medium',
    roleTargets: ['admin', 'staff', 'sales', 'taster'],
    tags: ['sampling', 'field reporting', 'activation'],
    whyItMatters:
      'This supports the portal workflow you already use for tasting reports, media uploads, and account follow-up.',
    actionLabel: 'Reinforce report quality',
    isAHAWCRelevant: true,
  },
  {
    id: 'delivery-route-disruption-midatlantic',
    title: 'Mid-Atlantic freight and local weather disruptions are creating tighter delivery windows this week',
    summary:
      'Operations coverage points to increased route risk from regional congestion and weather volatility across several Mid-Atlantic corridors.',
    sourceName: 'The Beverage Journal',
    sourceUrl: 'https://www.thebeveragejournal.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-14',
    category: 'operations_alert',
    priority: 'high',
    roleTargets: ['admin', 'staff', 'driver'],
    tags: ['maryland', 'delivery', 'weather', 'routes'],
    whyItMatters:
      'Dispatch and drivers should expect tighter ETA management and more proactive account communication if routes slip.',
    actionLabel: 'Review active routes',
    isAHAWCRelevant: true,
    isMarylandRelevant: true,
  },
  {
    id: 'retail-buyer-display-expectations',
    title: 'Independent retailers are asking suppliers for turnkey display support, not just case incentives',
    summary:
      'Retail coverage shows more store owners expecting signage, shelf talkers, and display creativity before committing to a bigger reset.',
    sourceName: 'Beverage Dynamics',
    sourceUrl: 'https://beveragedynamics.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-08',
    category: 'retail_insight',
    priority: 'medium',
    roleTargets: ['admin', 'sales', 'customer'],
    tags: ['retail', 'displays', 'signage', 'sell-through'],
    whyItMatters:
      'This strengthens the case for the new promotion catalog and account-targeted marketing material support.',
    actionLabel: 'Publish new promo items',
    isAHAWCRelevant: true,
  },
  {
    id: 'bartender-flavor-preference-trends',
    title: 'Bartender trend coverage points toward cleaner flavor narratives and more transparent production stories',
    summary:
      'On-premise operators are responding better to spirits with a clear origin story and concise tasting notes rather than novelty-heavy positioning.',
    sourceName: 'Chilled Magazine',
    sourceUrl: 'https://chilledmagazine.com/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-07',
    category: 'consumer_report',
    priority: 'low',
    roleTargets: ['sales', 'taster'],
    tags: ['bartenders', 'storytelling', 'brand positioning'],
    whyItMatters:
      'Useful for rep talking points and taster scripts when positioning Wisher in bars and restaurants.',
    actionLabel: 'Refine account talking points',
    isWisherRelevant: true,
  },
]

export function getIndustryNewsForAudience(audience: IndustryNewsAudience) {
  return INDUSTRY_NEWS_ITEMS.filter(item => item.roleTargets.includes(audience)).sort((left, right) => {
    const priorityScore = { high: 3, medium: 2, low: 1 }
    const priorityDiff = priorityScore[right.priority] - priorityScore[left.priority]
    if (priorityDiff !== 0) return priorityDiff
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  })
}

export function getIndustryNewsHighlights(audience: IndustryNewsAudience, limit = 4) {
  return getIndustryNewsForAudience(audience).slice(0, limit)
}

export function getIndustryNewsSections(audience: IndustryNewsAudience) {
  const stories = getIndustryNewsForAudience(audience)
  return {
    topStories: stories.slice(0, 4),
    wisherWatch: stories.filter(item => item.isWisherRelevant).slice(0, 4),
    ahawcRelevant: stories.filter(item => item.isAHAWCRelevant || item.isMarylandRelevant).slice(0, 4),
    trendReports: stories.filter(item => item.category === 'trend_report' || item.category === 'consumer_report').slice(0, 4),
  }
}

const audienceHref: Record<IndustryNewsAudience, string> = {
  admin: '/admin/news',
  staff: '/staff/news',
  sales: '/sales/news',
  taster: '/taster/news',
  driver: '/driver/news',
  customer: '/customer/news',
}

export function getIndustryNewsNotificationPreview(
  item: IndustryNewsItem,
  audience: IndustryNewsAudience
): IndustryNewsPreview {
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
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">${item.sourceName} • ${item.publishedAt}</p>
          <p style="margin: 0 0 10px; font-size: 18px; font-weight: 700; color: #0f172a;">${item.title}</p>
          <p style="margin: 0 0 12px; font-size: 14px; color: #475569;">${item.summary}</p>
          <p style="margin: 0; font-size: 13px; color: #0f172a;"><strong>Why it matters:</strong> ${item.whyItMatters}</p>
        </td>
      </tr>
    </table>
  `.trim()
}
