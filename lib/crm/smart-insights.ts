import OpenAI from 'openai'
import type { CRMAccountDetail } from '@/lib/crm/account-read'
import type { AccountActivityItem, AccountInventoryItem, AccountNoteItem } from '@/lib/crm/account-detail-data'

type InsightPriority = 'high' | 'medium' | 'low'

export type SmartInsightItem = {
  id: string
  title: string
  description: string
  category: string
  priority: InsightPriority
  actionLabel?: string
  actionHref?: string
  reasoning?: string[]
}

export type SmartInsightsResult = {
  summary: string
  recommendations: SmartInsightItem[]
  alerts: SmartInsightItem[]
  generatedAt: Date
  sourceSnapshotAt: Date
  usedAi: boolean
  freshnessNote: string
}

type SmartInsightsInput = {
  account: CRMAccountDetail
  accountContacts: Array<{ id: string; name: string; title: string | null; email: string | null; phone: string | null; isPrimary: boolean }>
  recentOrders: Array<{ id: string; status: string; total: string; createdAt: Date }>
  recentDeliveries: Array<{ deliveryId: string; status: string; weekStartDate: string; stopStatus: string; completedAt: Date | null }>
  recentTastings: Array<{ id: string; eventName: string; status: string; scheduledAt: Date; endAt: Date | null }>
  recentTexts: Array<{ id: string; direction: string; body: string; createdAt: Date; phoneNumber: string }>
  notes: AccountNoteItem[]
  inventoryItems: AccountInventoryItem[]
  activityItems: AccountActivityItem[]
  mode: 'admin' | 'staff' | 'sales'
  regionName?: string | null
}

type AIGeneratedInsight = {
  title: string
  description: string
  category: string
  priority: InsightPriority
  reasoning?: string[]
}

type AISmartInsightsPayload = {
  summary: string
  recommendations: AIGeneratedInsight[]
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

function getDaysSince(date: Date | null | undefined) {
  if (!date) return null
  const diff = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function buildBasePath(mode: 'admin' | 'staff' | 'sales', accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}` : `/${mode}/crm/${accountId}`
}

function buildContactsPath(mode: 'admin' | 'staff' | 'sales', accountId: string) {
  return mode === 'sales' ? `/sales/accounts/${accountId}/contacts` : `/${mode}/crm/${accountId}/contacts`
}

function dedupeInsights(items: SmartInsightItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.title.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function rankPriority(a: InsightPriority, b: InsightPriority) {
  const weight = { high: 3, medium: 2, low: 1 }
  return weight[b] - weight[a]
}

function pushInsight(
  list: SmartInsightItem[],
  item: SmartInsightItem,
) {
  list.push(item)
}

function buildRuleInsights(input: SmartInsightsInput) {
  const { account, accountContacts, recentOrders, recentDeliveries, recentTastings, recentTexts, notes, inventoryItems, activityItems, mode, regionName } = input
  const basePath = buildBasePath(mode, account.id)
  const recommendations: SmartInsightItem[] = []
  const alerts: SmartInsightItem[] = []

  const latestOrder = recentOrders[0]?.createdAt ?? null
  const latestText = recentTexts[0]?.createdAt ?? null
  const latestNote = notes[0]?.updatedAt ?? notes[0]?.createdAt ?? null
  const latestDelivery = recentDeliveries[0]?.completedAt ?? null
  const completedTastings = recentTastings.filter((tasting) => tasting.status === 'completed')
  const latestInventoryUpdate = inventoryItems[0]?.updatedAt ?? null
  const inventoryCases = inventoryItems.reduce((sum, item) => sum + Number(item.casesOnHand || 0), 0)
  const inventoryBottles = inventoryItems.reduce((sum, item) => sum + Number(item.bottlesOnHand || 0), 0)
  const positiveBalance = Number(account.balance ?? 0) > 0
  const daysSinceLastOrder = getDaysSince(latestOrder)
  const daysSinceLastNote = getDaysSince(latestNote)
  const daysSinceLastText = getDaysSince(latestText)
  const hasPrimaryContact = accountContacts.some((contact) => contact.isPrimary)
  const hasAnyEmail = Boolean(account.email || account.businessEmail || account.pocEmail || accountContacts.some((contact) => contact.email))
  const hasAnyPhone = Boolean(account.phone || account.businessPhone || account.pocPhone || accountContacts.some((contact) => contact.phone))
  const recentIssueNote = notes.find((note) => /issue|problem|follow up|follow-up|bounced|wrong email|old email|slow|payment|restock|reorder/i.test(note.noteBody))
  const recentIssueActivity = activityItems.find((item) => /failed|cancelled|declined|refund|overdue|issue/i.test(`${item.title} ${item.description ?? ''}`))

  if (!account.pocName) {
    pushInsight(alerts, {
      id: 'missing-poc',
      title: 'Point of contact missing',
      description: 'No buyer or point of contact is saved on the account record.',
      category: 'Contact Gap',
      priority: 'high',
      actionLabel: 'Edit Account',
      actionHref: `${basePath}?tab=settings#edit-account`,
      reasoning: ['POC name field is empty', hasPrimaryContact ? 'A contact exists, but it is not saved as the main POC' : 'No contact is marked as primary'],
    })
  }

  if (!account.pocEmail) {
    pushInsight(alerts, {
      id: 'missing-poc-email',
      title: 'POC email missing',
      description: 'The account is missing a direct email for the buyer or main point of contact.',
      category: 'Contact Gap',
      priority: hasAnyEmail ? 'medium' : 'high',
      actionLabel: hasPrimaryContact ? 'Manage Contacts' : 'Edit Account',
      actionHref: hasPrimaryContact ? buildContactsPath(mode, account.id) : `${basePath}?tab=settings#edit-account`,
      reasoning: [hasAnyEmail ? 'An account-level email exists, but no POC email is saved' : 'No usable email is available on the account or contact records'],
    })
  }

  if (!hasAnyPhone) {
    pushInsight(alerts, {
      id: 'missing-phone',
      title: 'No working phone on file',
      description: 'The record does not have a main, business, POC, or contact phone number saved.',
      category: 'Communication Gap',
      priority: 'high',
      actionLabel: 'Edit Account',
      actionHref: `${basePath}?tab=settings#edit-account`,
      reasoning: ['Phone, business phone, and POC phone are empty', 'No contact phone was found in the contact list'],
    })
  }

  if (!account.hoursOfOperation) {
    pushInsight(alerts, {
      id: 'missing-hours',
      title: 'Hours need verification',
      description: 'Business hours are not set, which can slow down delivery and outreach planning.',
      category: 'Admin Cleanup',
      priority: 'low',
      actionLabel: 'Edit Account',
      actionHref: `${basePath}?tab=settings#edit-account`,
      reasoning: ['Hours of operation field is empty'],
    })
  }

  if (!regionName) {
    pushInsight(alerts, {
      id: 'missing-region',
      title: 'Region assignment missing',
      description: 'This account is not assigned to a sales region yet.',
      category: 'Admin Cleanup',
      priority: mode === 'admin' ? 'medium' : 'low',
      actionLabel: 'Edit Account',
      actionHref: `${basePath}?tab=settings#edit-account`,
      reasoning: ['assignedRegionId is empty on the account record'],
    })
  }

  if (!account.hubspotCompanyId && !account.hubspotContactId) {
    pushInsight(alerts, {
      id: 'hubspot-sync-missing',
      title: 'HubSpot sync missing',
      description: 'The account has not been connected to HubSpot yet.',
      category: 'Admin Cleanup',
      priority: 'low',
      actionLabel: 'Edit Account',
      actionHref: `${basePath}?tab=settings`,
      reasoning: ['No HubSpot company or contact id is stored for this account'],
    })
  }

  if (daysSinceLastOrder === null) {
    pushInsight(recommendations, {
      id: 'no-orders-yet',
      title: 'No order history yet',
      description: 'This account has not placed an order yet. Confirm whether an opening order is needed.',
      category: 'Sales Opportunity',
      priority: 'high',
      actionLabel: mode === 'sales' ? 'View Orders' : 'Create Order',
      actionHref: mode === 'sales' ? `${basePath}?tab=orders` : `/${mode}/orders/new?customer=${account.id}`,
      reasoning: ['No orders were found for this account'],
    })
  } else if (daysSinceLastOrder >= 28) {
    pushInsight(recommendations, {
      id: 'order-gap',
      title: 'Order cadence looks quiet',
      description: `No order has been placed in ${daysSinceLastOrder} days. Check in on reorder timing and restock needs.`,
      category: 'Reorder Opportunity',
      priority: daysSinceLastOrder >= 45 ? 'high' : 'medium',
      actionLabel: 'View Orders',
      actionHref: `${basePath}?tab=orders`,
      reasoning: [`Latest order was ${daysSinceLastOrder} days ago`],
    })
  }

  if (inventoryItems.length > 0 && inventoryCases <= 3 && inventoryBottles <= 12 && !latestDelivery) {
    pushInsight(recommendations, {
      id: 'inventory-low-no-delivery',
      title: 'Inventory may need restock follow-up',
      description: 'Inventory on hand is low and there is no recent completed delivery tied to the account.',
      category: 'Inventory Nudge',
      priority: 'medium',
      actionLabel: mode === 'admin' ? 'Add Delivery' : mode === 'sales' ? 'View Orders' : 'Create Order',
      actionHref: mode === 'admin' ? '/admin/deliveries/new' : mode === 'sales' ? `${basePath}?tab=orders` : `/${mode}/orders/new?customer=${account.id}`,
      reasoning: [`Inventory on hand is ${inventoryCases.toFixed(2)} cases and ${inventoryBottles.toFixed(2)} bottles`, 'No completed delivery was found in recent account activity'],
    })
  }

  if (completedTastings.length === 0) {
    pushInsight(recommendations, {
      id: 'no-completed-tastings',
      title: 'Tasting opportunity available',
      description: 'This account has not completed a tasting yet. A tasting could support sell-through or re-engagement.',
      category: 'Tasting Opportunity',
      priority: 'medium',
      actionLabel: 'Schedule Tasting',
      actionHref: `/${mode}/tastings?account=${account.id}`,
      reasoning: ['No completed tasting records were found for this account'],
    })
  }

  if (daysSinceLastNote === null || daysSinceLastNote >= 30) {
    pushInsight(recommendations, {
      id: 'stale-notes',
      title: 'Account notes are stale',
      description: daysSinceLastNote === null
        ? 'No internal notes are on file yet. Log the next outreach or operational update.'
        : `No fresh note has been logged in ${daysSinceLastNote} days. Capture the next touchpoint.`,
      category: 'Relationship Risk',
      priority: daysSinceLastNote === null ? 'medium' : 'low',
      actionLabel: 'Add Note',
      actionHref: `${basePath}?tab=notes-activity`,
      reasoning: [daysSinceLastNote === null ? 'No account notes exist' : `Latest account note is ${daysSinceLastNote} days old`],
    })
  }

  if (daysSinceLastText === null && !hasAnyEmail) {
    pushInsight(recommendations, {
      id: 'limited-communication-paths',
      title: 'Communication channels are thin',
      description: 'There is no recent SMS activity and no email on file, so outreach options are limited.',
      category: 'Communication Gap',
      priority: 'medium',
      actionLabel: hasPrimaryContact ? 'Manage Contacts' : 'Edit Account',
      actionHref: hasPrimaryContact ? buildContactsPath(mode, account.id) : `${basePath}?tab=settings#edit-account`,
      reasoning: ['No recent text history was found', 'No email is saved on the account or contact records'],
    })
  }

  if (positiveBalance) {
    pushInsight(recommendations, {
      id: 'balance-follow-up',
      title: 'Outstanding balance needs visibility',
      description: 'This account has an open balance. Make sure outreach and reorder conversations account for payment status.',
      category: 'Account Health',
      priority: Number(account.balance) > 500 ? 'high' : 'medium',
      actionLabel: mode === 'admin' ? 'View Orders' : 'View Activity',
      actionHref: `${basePath}?tab=orders`,
      reasoning: [`Balance due is ${Number(account.balance).toFixed(2)}`, `Payment terms are ${account.paymentTerms ?? 'not set'}`],
    })
  }

  if (recentIssueNote) {
    pushInsight(recommendations, {
      id: `note-signal-${recentIssueNote.id}`,
      title: 'Recent notes suggest follow-up is needed',
      description: 'Recent note content indicates an issue, timing request, or contact problem that should be reviewed before the next touchpoint.',
      category: 'Relationship Risk',
      priority: 'medium',
      actionLabel: 'View Notes',
      actionHref: `${basePath}?tab=notes-activity`,
      reasoning: [recentIssueNote.noteBody.slice(0, 160)],
    })
  }

  if (recentIssueActivity) {
    pushInsight(recommendations, {
      id: `activity-signal-${recentIssueActivity.id}`,
      title: 'Recent activity shows a friction point',
      description: 'There is a recent failed, cancelled, or refund-related event in the account history worth reviewing.',
      category: 'Account Health',
      priority: 'medium',
      actionLabel: 'View Activity',
      actionHref: `${basePath}?tab=notes-activity`,
      reasoning: [`${recentIssueActivity.title}${recentIssueActivity.description ? `: ${recentIssueActivity.description}` : ''}`],
    })
  }

  const summaryFacts: string[] = []
  summaryFacts.push(`${account.companyName} is ${getDaysSince(account.createdAt) !== null && getDaysSince(account.createdAt)! < 45 ? 'a newer' : 'an active'} account in ${account.city || account.state || 'the CRM'}.`)
  summaryFacts.push(daysSinceLastOrder === null ? 'It has no order history yet.' : daysSinceLastOrder >= 28 ? `Ordering looks quiet with the latest order ${daysSinceLastOrder} days ago.` : 'Recent ordering activity is on file.')
  if (!account.pocName || !account.pocEmail) {
    summaryFacts.push('Buyer contact details still need cleanup.')
  } else {
    summaryFacts.push('Primary buyer contact details are mostly in place.')
  }
  if (recentIssueNote) {
    summaryFacts.push('Recent notes suggest a follow-up or data correction may be needed.')
  } else if (daysSinceLastNote === null || daysSinceLastNote >= 30) {
    summaryFacts.push('Internal follow-up documentation is stale.')
  }

  return {
    summary: summaryFacts.slice(0, 4).join(' '),
    recommendations: dedupeInsights(recommendations).sort((a, b) => rankPriority(a.priority, b.priority)).slice(0, 4),
    alerts: dedupeInsights(alerts).sort((a, b) => rankPriority(a.priority, b.priority)).slice(0, 4),
    sourceSnapshotAt: new Date(
      Math.max(
        account.createdAt.getTime(),
        latestOrder?.getTime() ?? 0,
        latestText?.getTime() ?? 0,
        latestNote?.getTime() ?? 0,
        latestDelivery?.getTime() ?? 0,
        latestInventoryUpdate?.getTime() ?? 0,
        recentTastings[0]?.scheduledAt?.getTime() ?? 0,
      ),
    ),
  }
}

function buildAiContext(input: SmartInsightsInput, ruleSummary: string, recommendations: SmartInsightItem[], alerts: SmartInsightItem[]) {
  const { account, accountContacts, recentOrders, recentDeliveries, recentTastings, recentTexts, notes, inventoryItems, activityItems, regionName } = input

  return {
    account: {
      companyName: account.companyName,
      city: account.city,
      state: account.state,
      businessType: account.businessType,
      createdAt: account.createdAt.toISOString(),
      paymentTerms: account.paymentTerms,
      balance: account.balance,
      creditLimit: account.creditLimit,
      notificationPreference: account.notificationPreference,
      pocName: account.pocName,
      pocEmail: account.pocEmail,
      pocPhone: account.pocPhone,
      hoursOfOperation: account.hoursOfOperation,
      regionName: regionName ?? null,
      hubspotSynced: Boolean(account.hubspotCompanyId || account.hubspotContactId),
    },
    rollup: {
      contacts: accountContacts.length,
      orders: recentOrders.length,
      deliveries: recentDeliveries.length,
      tastings: recentTastings.length,
      texts: recentTexts.length,
      notes: notes.length,
      inventoryItems: inventoryItems.length,
    },
    recentOrders: recentOrders.slice(0, 5).map((order) => ({
      status: order.status,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
    })),
    recentDeliveries: recentDeliveries.slice(0, 5).map((delivery) => ({
      status: delivery.status,
      stopStatus: delivery.stopStatus,
      completedAt: delivery.completedAt?.toISOString() ?? null,
    })),
    recentTastings: recentTastings.slice(0, 5).map((tasting) => ({
      eventName: tasting.eventName,
      status: tasting.status,
      scheduledAt: tasting.scheduledAt.toISOString(),
    })),
    recentTexts: recentTexts.slice(0, 4).map((message) => ({
      direction: message.direction,
      body: message.body.slice(0, 160),
      createdAt: message.createdAt.toISOString(),
    })),
    recentNotes: notes.slice(0, 5).map((note) => ({
      noteType: note.noteType,
      body: note.noteBody.slice(0, 220),
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      pinned: note.isPinned,
    })),
    recentActivity: activityItems.slice(0, 6).map((item) => ({
      title: item.title,
      description: item.description,
      eventType: item.eventType,
      createdAt: item.createdAt.toISOString(),
    })),
    ruleSummary,
    ruleRecommendations: recommendations.map((item) => ({ title: item.title, description: item.description, category: item.category, priority: item.priority })),
    ruleAlerts: alerts.map((item) => ({ title: item.title, description: item.description, category: item.category, priority: item.priority })),
  }
}

async function generateAiEnhancements(input: SmartInsightsInput, ruleSummary: string, recommendations: SmartInsightItem[], alerts: SmartInsightItem[]) {
  if (!openai) return null

  const context = buildAiContext(input, ruleSummary, recommendations, alerts)
  const prompt = `You are generating concise CRM account guidance for internal operations and sales users.

Use ONLY the provided account data. Do not invent facts. If evidence is weak, say so carefully.
Focus on account context, follow-up needs, data gaps, reorder/tasting opportunities, and unresolved issues mentioned in notes or activity.
Keep recommendations practical and specific.

Return ONLY valid JSON with this shape:
{
  "summary": "2-4 sentence operational summary grounded in the data",
  "recommendations": [
    {
      "title": "short title",
      "description": "1-2 sentence actionable recommendation",
      "category": "Sales Opportunity | Contact Gap | Relationship Risk | Inventory Nudge | Reorder Opportunity | Delivery Insight | Tasting Opportunity | Communication Gap | Admin Cleanup | Account Health",
      "priority": "high" | "medium" | "low",
      "reasoning": ["fact 1", "fact 2"]
    }
  ]
}

Do not repeat obvious rule alerts unless they materially affect the next step. Prefer note-derived or pattern-based recommendations when evidence exists. Maximum 3 recommendations.

DATA:
${JSON.stringify(context)}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  return JSON.parse(jsonMatch[0]) as AISmartInsightsPayload
}

export async function generateAccountSmartInsights(input: SmartInsightsInput): Promise<SmartInsightsResult> {
  const generatedAt = new Date()
  const rules = buildRuleInsights(input)
  let summary = rules.summary
  let recommendations = [...rules.recommendations]
  let usedAi = false

  try {
    const ai = await generateAiEnhancements(input, rules.summary, rules.recommendations, rules.alerts)
    if (ai?.summary) {
      summary = ai.summary
      usedAi = true
    }
    if (ai?.recommendations?.length) {
      const basePath = buildBasePath(input.mode, input.account.id)
      const aiRecommendations: SmartInsightItem[] = ai.recommendations.map((item, index) => ({
        id: `ai-${index}`,
        title: item.title,
        description: item.description,
        category: item.category,
        priority: item.priority,
        actionLabel:
          /tasting/i.test(item.category) || /tasting/i.test(item.title)
            ? 'Schedule Tasting'
            : /contact|communication/i.test(item.category)
              ? 'Manage Contacts'
              : /inventory|reorder/i.test(item.category)
                ? 'View Inventory'
                : /delivery/i.test(item.category)
                  ? input.mode === 'admin'
                    ? 'Add Delivery'
                    : 'View Orders'
                  : /admin cleanup/i.test(item.category)
                    ? 'Edit Account'
                    : 'Add Note',
        actionHref:
          /tasting/i.test(item.category) || /tasting/i.test(item.title)
            ? `/${input.mode}/tastings?account=${input.account.id}`
            : /contact|communication/i.test(item.category)
              ? buildContactsPath(input.mode, input.account.id)
              : /inventory|reorder/i.test(item.category)
                ? `${basePath}?tab=inventory`
                : /delivery/i.test(item.category)
                  ? input.mode === 'admin'
                    ? '/admin/deliveries/new'
                    : `${basePath}?tab=orders`
                  : /admin cleanup/i.test(item.category)
                    ? `${basePath}?tab=settings#edit-account`
                    : `${basePath}?tab=notes-activity`,
        reasoning: item.reasoning,
      }))
      recommendations = dedupeInsights([...aiRecommendations, ...recommendations])
        .sort((a, b) => rankPriority(a.priority, b.priority))
        .slice(0, 5)
    }
  } catch (error) {
    console.error('Failed to generate AI CRM account insights:', error)
  }

  return {
    summary,
    recommendations,
    alerts: rules.alerts,
    generatedAt,
    sourceSnapshotAt: rules.sourceSnapshotAt,
    usedAi,
    freshnessNote: usedAi
      ? 'Generated from current account data, notes, activity, and recent operational history.'
      : 'Built from current account data using rule-based guidance.',
  }
}
