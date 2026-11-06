import React from 'react'
import { createRoot } from 'react-dom/client'
import { RecipeEmailEngagementSummary, RecipeEmailEngagementCells } from '../../components/marketing/RecipeEmailEngagement'
import { RecipeEmailEngagementChart } from '../../components/marketing/RecipeEmailEngagementChart'
import { calculateRecipeEngagement } from '../../lib/marketing/recipe-email-engagement'

const marker = { kind: 'recipe_email_tracking_started', metadata: {}, createdAt: '2026-11-06T12:00:00Z' }
const signal = kind => ({ kind, metadata: { contactId: 'reader', url: 'https://wishervodka.com/recipe' }, createdAt: '2026-11-06T12:01:00Z' })
const active = calculateRecipeEngagement(10, [marker, signal('recipe_email_opened'), signal('recipe_email_clicked')])
const zero = calculateRecipeEngagement(10, [marker])
const old = calculateRecipeEngagement(100, [])
createRoot(document.getElementById('root')).render(<main className="space-y-6 bg-[#f4f1ed] p-4 sm:p-8">
  <h1 className="font-display text-3xl uppercase">Weekly recipe emails</h1>
  <RecipeEmailEngagementSummary campaigns={[active, zero, old]} />
  <div className="min-w-0 rounded-xl border bg-white p-4"><RecipeEmailEngagementChart data={[{ week: 'Oct 19', openRate: null, clickRate: null, engagementRate: null }, { week: 'Oct 26', openRate: 0, clickRate: 0, engagementRate: 0 }, { week: 'Nov 2', openRate: 10, clickRate: 10, engagementRate: 10 }]} /></div>
  <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-[720px] w-full text-sm"><thead><tr><th>Send</th><th>Open rate</th><th>Click-through</th><th>Engagement</th></tr></thead><tbody>
    <tr aria-label="Tracked active send"><td>Nov 2</td><RecipeEmailEngagementCells engagement={active} /></tr>
    <tr aria-label="Tracked zero send"><td>Oct 26</td><RecipeEmailEngagementCells engagement={zero} /></tr>
    <tr aria-label="Historical send"><td>Oct 19</td><RecipeEmailEngagementCells engagement={old} /></tr>
  </tbody></table></div>
  <RecipeEmailEngagementSummary campaigns={[]} unavailable />
</main>)

