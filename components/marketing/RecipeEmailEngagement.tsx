import { aggregateRecipeEngagement, formatEngagementRate, type RecipeEngagement } from '@/lib/marketing/recipe-email-engagement'

export function RecipeEmailEngagementSummary({ campaigns, unavailable = false }: { campaigns: RecipeEngagement[]; unavailable?: boolean }) {
  const summary = aggregateRecipeEngagement(campaigns)
  const cards = [
    { label: 'Open rate', value: summary.openRate, count: summary.opened, hint: 'Unique recipients with a recorded image open' },
    { label: 'Click-through rate', value: summary.clickRate, count: summary.clicked, hint: 'Unique recipients who clicked a marketing link' },
    { label: 'Engagement rate', value: summary.engagementRate, count: summary.engaged, hint: 'Unique recipients who opened or clicked' },
    { label: 'Click-to-open rate', value: summary.clickToOpenRate, count: null, hint: 'Recorded openers who also clicked' },
  ]
  return <section aria-label="Email engagement" className="space-y-3">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <div key={card.label} className="rounded-xl border bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{unavailable ? 'Unavailable' : formatEngagementRate(card.value, summary.campaigns > 0)}</p>
      <p className="mt-1 text-xs text-slate-500">{card.count !== null && summary.campaigns > 0 ? `${card.count.toLocaleString()} recipients · ` : ''}{card.hint}</p>
    </div>)}</div>
    {unavailable ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Engagement data could not be loaded. Refresh to retry. Send history is still available.</p> : <p className="text-sm text-slate-600">{summary.campaigns} tracked sends · {summary.sentCount.toLocaleString()} accepted emails. {summary.untrackedCampaigns ? `${summary.untrackedCampaigns} older or untracked sends are excluded from these rates. ` : ''}Tracking begins with emails sent after this update; historical opens and clicks cannot be recovered here.</p>}
    <details className="rounded-xl border bg-white p-4 text-sm text-slate-600"><summary className="min-h-8 cursor-pointer font-semibold text-slate-900">How engagement is measured</summary>
      <p className="mt-2">Open and click-through rates use unique recipients per send divided by emails accepted by the sending service. Engagement counts recipients who opened or clicked once, even if they did both. Combined rates use total recipients across tracked sends, not an average of percentages.</p>
      <p className="mt-2">Click-to-open is the share of recorded openers who also clicked. Clicks from recipients who block images still count toward click-through and engagement. Unsubscribe links are excluded from marketing clicks.</p>
      <p className="mt-2">Acceptance does not confirm inbox delivery. Image blocking can hide opens; privacy proxies and automated security scanners can inflate opens or clicks. These are observed signals, not proof of human engagement. Repeat opens and repeat clicks on the same link do not inflate unique counts.</p>
    </details>
  </section>
}

export function RecipeEmailEngagementCells({ engagement, unavailable = false }: { engagement: RecipeEngagement; unavailable?: boolean }) {
  return <>{[{ rate: engagement.openRate, count: engagement.opened }, { rate: engagement.clickRate, count: engagement.clicked }, { rate: engagement.engagementRate, count: engagement.engaged }].map((item, index) => <td key={index} className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
    {unavailable ? 'Unavailable' : formatEngagementRate(item.rate, engagement.tracked)}
    {!unavailable && engagement.tracked ? <p className="text-xs text-slate-400">{item.count} unique</p> : null}
  </td>)}</>
}

