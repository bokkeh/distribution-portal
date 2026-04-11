'use server'

import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, salesMembers } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { generateSignedReadUrl } from '@/lib/gcs/client'
import { getAccountMediaFeed } from '@/lib/crm/account-detail-data'
import { normalizePhone } from '@/lib/telnyx/compliance'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const ACCOUNT_MEDIA_INSIGHT_ROLES = ['admin', 'staff', 'sales_rep', 'sales_manager'] as const

export type AccountMediaInsights = {
  summary: string
  recentInsight: string
  trendInsight: string
  accountCondition: 'improving' | 'stable' | 'declining' | 'mixed' | 'insufficient_data'
  opportunities: string[]
  risks: string[]
  recommendations: string[]
  evidenceTimeline: Array<{ period: string; observation: string }>
  analyzedAt: string
  mediaCount: number
  imageCount: number
  recentMediaCount: number
}

function extractGCSFilePath(url: string): string | null {
  if (url.startsWith('/api/image')) {
    try {
      const params = new URLSearchParams(url.split('?')[1] ?? '')
      return params.get('path')
    } catch {
      return null
    }
  }

  if (url.startsWith('/api/photo')) {
    try {
      const params = new URLSearchParams(url.split('?')[1] ?? '')
      const rawUrl = params.get('url')
      if (!rawUrl) return null
      const bucketName = process.env.GCS_BUCKET_NAME ?? ''
      const prefix = `https://storage.googleapis.com/${bucketName}/`
      return rawUrl.startsWith(prefix) ? rawUrl.slice(prefix.length) : rawUrl
    } catch {
      return null
    }
  }

  const bucketName = process.env.GCS_BUCKET_NAME ?? ''
  const prefix = `https://storage.googleapis.com/${bucketName}/`
  if (url.startsWith(prefix)) return url.slice(prefix.length)
  return null
}

async function getAccessibleUrl(url: string): Promise<string | null> {
  try {
    const filePath = extractGCSFilePath(url)
    if (filePath) return await generateSignedReadUrl(filePath)
    return url
  } catch {
    return url
  }
}

function getAccountPhonesForInboxMatch(...values: Array<string | null | undefined>) {
  const phones = new Set<string>()

  for (const value of values) {
    const phone = value?.trim()
    if (!phone) continue
    phones.add(phone)

    try {
      phones.add(normalizePhone(phone))
    } catch {
      // keep raw phone only
    }
  }

  return Array.from(phones)
}

async function requireAccountMediaInsightAccess(accountId: string) {
  const session = await requireRole(...ACCOUNT_MEDIA_INSIGHT_ROLES)
  const roles = new Set((session.user.roles ?? [session.user.role]).filter(Boolean) as string[])
  const canManageAny = roles.has('admin') || roles.has('staff') || roles.has('sales_manager')

  const [account] = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      businessType: customerAccounts.businessType,
      phone: customerAccounts.phone,
      businessPhone: customerAccounts.businessPhone,
      pocPhone: customerAccounts.pocPhone,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) {
    throw new Error('Account not found.')
  }

  if (!canManageAny) {
    const [member] = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member || account.assignedSalesRepId !== member.id) {
      throw new Error('You are not assigned to this account.')
    }
  }

  return { account }
}

const ANALYSIS_PROMPT = `You are an account intelligence analyst for a beverage distribution CRM.

You are reviewing account media across time to help sales reps, sales managers, and admins understand store condition, merchandising, delivery execution, customer engagement, and account momentum.

Rules:
- Use timestamps carefully. Weight the last 45 days most heavily for current-state insights.
- Also compare older media to identify changes over time across months when evidence exists.
- Only claim what is supported by the provided images and metadata.
- If evidence is mixed or weak, say so.
- Be practical for sales/account-management use, not generic.
- Media categories may include tasting, store visit, delivery, customers, employees, and events.
- Some assets may be videos or may only be represented by metadata. Mention that limitation when relevant.

Return ONLY valid JSON:
{
  "summary": "2-4 sentence executive summary",
  "recentInsight": "1-3 sentences focused on the most recent account condition",
  "trendInsight": "1-3 sentences describing multi-month changes or noting insufficient history",
  "accountCondition": "improving" | "stable" | "declining" | "mixed" | "insufficient_data",
  "opportunities": ["specific opportunity 1", "specific opportunity 2", "specific opportunity 3"],
  "risks": ["specific risk 1", "specific risk 2", "specific risk 3"],
  "recommendations": ["action 1", "action 2", "action 3"],
  "evidenceTimeline": [
    { "period": "Recent", "observation": "short evidence-backed observation" },
    { "period": "Historical", "observation": "short evidence-backed observation" }
  ]
}`

function buildMetadataBlock(
  account: {
    companyName: string
    address: string | null
    city: string | null
    state: string | null
    businessType: string | null
  },
  mediaItems: Awaited<ReturnType<typeof getAccountMediaFeed>>,
) {
  const now = Date.now()
  const recentThreshold = now - (45 * 24 * 60 * 60 * 1000)
  const recentCount = mediaItems.filter((item) => new Date(item.createdAt).getTime() >= recentThreshold).length

  const lines = [
    `ACCOUNT: ${account.companyName}`,
    `LOCATION: ${[account.address, account.city, account.state].filter(Boolean).join(', ') || 'Unknown'}`,
    `BUSINESS TYPE: ${account.businessType ?? 'Unknown'}`,
    `TOTAL MEDIA ITEMS: ${mediaItems.length}`,
    `RECENT MEDIA ITEMS (last 45 days): ${recentCount}`,
    '',
    'MEDIA TIMELINE:',
    ...mediaItems.slice(0, 40).map((item, index) =>
      `${index + 1}. ${new Date(item.createdAt).toISOString()} | ${item.label} | ${item.sourceType} | ${item.sourceLabel}${item.caption ? ` | Caption: ${item.caption}` : ''}`
    ),
  ]

  return { metadataBlock: lines.join('\n'), recentCount }
}

export async function analyzeAccountMedia(accountId: string): Promise<AccountMediaInsights | { error: string }> {
  try {
    if (!openai) {
      return { error: 'OPENAI_API_KEY is not configured.' }
    }

    const { account } = await requireAccountMediaInsightAccess(accountId)
    const accountPhones = getAccountPhonesForInboxMatch(account.phone, account.businessPhone, account.pocPhone)
    const mediaItems = await getAccountMediaFeed(accountId, accountPhones, 'admin')

    if (!mediaItems.length) {
      return { error: 'No account media is available to analyze yet.' }
    }

    const sortedItems = [...mediaItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const now = Date.now()
    const recentThreshold = now - (45 * 24 * 60 * 60 * 1000)
    const recentItems = sortedItems.filter((item) => new Date(item.createdAt).getTime() >= recentThreshold)
    const historicalItems = sortedItems.filter((item) => new Date(item.createdAt).getTime() < recentThreshold)

    const visualCandidates = [
      ...recentItems.slice(0, 10),
      ...historicalItems.slice(0, 4),
    ].filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)

    const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = []
    for (const item of visualCandidates) {
      const accessibleUrl = await getAccessibleUrl(item.url)
      if (accessibleUrl) {
        imageContent.push({
          type: 'image_url',
          image_url: { url: accessibleUrl, detail: 'high' },
        })
      }
    }

    const { metadataBlock, recentCount } = buildMetadataBlock(account, sortedItems)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `${ANALYSIS_PROMPT}\n\nACCOUNT MEDIA DATA:\n${metadataBlock}\n\nVISUAL SAMPLE COUNT: ${imageContent.length}`,
            },
          ],
        },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { error: 'No JSON found in AI response.' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Omit<AccountMediaInsights, 'analyzedAt' | 'mediaCount' | 'imageCount' | 'recentMediaCount'>

    return {
      ...parsed,
      analyzedAt: new Date().toISOString(),
      mediaCount: sortedItems.length,
      imageCount: imageContent.length,
      recentMediaCount: recentCount,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to analyze account media.' }
  }
}
