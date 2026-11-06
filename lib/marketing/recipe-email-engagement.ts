export type RecipeEngagementEvent = { kind: string; metadata: unknown; createdAt: Date | string }
export type RecipeEngagement = ReturnType<typeof calculateRecipeEngagement>

export function calculateRecipeEngagement(sentCount: number, events: RecipeEngagementEvent[]) {
  const opened = new Set<string>(), clicked = new Set<string>()
  const links = new Map<string, Set<string>>()
  let tracked = false
  let latestAt: string | null = null
  for (const event of events) {
    if (event.kind === 'recipe_email_tracking_started') { tracked = true; continue }
    const data = event.metadata as { contactId?: unknown; url?: unknown }
    if (!data || typeof data.contactId !== 'string') continue
    if (event.kind === 'recipe_email_opened') opened.add(data.contactId)
    else if (event.kind === 'recipe_email_clicked') {
      clicked.add(data.contactId)
      if (typeof data.url === 'string') {
        const contacts = links.get(data.url) ?? new Set<string>()
        contacts.add(data.contactId); links.set(data.url, contacts)
      }
    } else continue
    tracked = true
    const at = new Date(event.createdAt).toISOString()
    if (!latestAt || at > latestAt) latestAt = at
  }
  const engaged = new Set([...opened, ...clicked])
  const openersWhoClicked = [...opened].filter(id => clicked.has(id)).length
  const rate = (count: number, denominator = sentCount) => tracked && denominator > 0 ? count / denominator * 100 : null
  return {
    tracked, sentCount, opened: opened.size, clicked: clicked.size, engaged: engaged.size, openersWhoClicked,
    openRate: rate(opened.size), clickRate: rate(clicked.size), engagementRate: rate(engaged.size), clickToOpenRate: rate(openersWhoClicked, opened.size), latestAt,
    links: [...links].map(([url, contacts]) => ({ url, recipients: contacts.size })).sort((a, b) => b.recipients - a.recipients || a.url.localeCompare(b.url)),
  }
}

export function aggregateRecipeEngagement(rows: RecipeEngagement[]) {
  const tracked = rows.filter(row => row.tracked)
  const sentCount = tracked.reduce((sum, row) => sum + row.sentCount, 0)
  const opened = tracked.reduce((sum, row) => sum + row.opened, 0)
  const clicked = tracked.reduce((sum, row) => sum + row.clicked, 0)
  const engaged = tracked.reduce((sum, row) => sum + row.engaged, 0)
  const openersWhoClicked = tracked.reduce((sum, row) => sum + row.openersWhoClicked, 0)
  return { campaigns: tracked.length, untrackedCampaigns: rows.length - tracked.length, sentCount, opened, clicked, engaged,
    openRate: sentCount ? opened / sentCount * 100 : null, clickRate: sentCount ? clicked / sentCount * 100 : null, engagementRate: sentCount ? engaged / sentCount * 100 : null, clickToOpenRate: opened ? openersWhoClicked / opened * 100 : null }
}

export function formatEngagementRate(value: number | null, tracked = true) { return !tracked ? 'Not tracked' : value === null ? '—' : `${value.toFixed(1)}%` }

