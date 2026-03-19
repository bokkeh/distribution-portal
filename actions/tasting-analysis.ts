'use server'

import OpenAI from 'openai'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/db'
import { tastings, tastingReports, tastingAnalyses } from '@/db/schema'
import type { TastingAnalysis } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { generateSignedReadUrl } from '@/lib/gcs/client'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function extractGCSFilePath(url: string): string | null {
  if (url.startsWith('/api/image')) {
    try {
      const params = new URLSearchParams(url.split('?')[1] ?? '')
      return params.get('path')
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

function getSeasonLabel(month: number): string {
  if (month >= 3 && month <= 5) return 'Spring'
  if (month >= 6 && month <= 8) return 'Summer'
  if (month >= 9 && month <= 11) return 'Fall'
  return 'Winter'
}

function getDayOfWeekLabel(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? 'Unknown'
}

function buildContextBlock(
  tasting: {
    eventName: string
    scheduledAt: Date
    storeAddress: string | null
    storeCity: string | null
    storeState: string | null
  },
  report: {
    actualStartTime: string | null
    actualEndTime: string | null
    samplesServed: number | null
    bottlesSold: number | null
    casesSold: number | null
    consumerInteractions: number | null
    accountFeedback: string | null
    highlights: string | null
    issues: string | null
  },
): string {
  const date = new Date(tasting.scheduledAt)
  const month = date.getMonth() + 1
  const day = date.getDay()
  const season = getSeasonLabel(date.getMonth())
  const dayName = getDayOfWeekLabel(day)
  const monthName = date.toLocaleString('en-US', { month: 'long' })
  const storeLocation = [tasting.storeAddress, tasting.storeCity, tasting.storeState].filter(Boolean).join(', ') || 'Unknown'
  const interactions = report.consumerInteractions ?? 0
  const bottles = report.bottlesSold ?? 0
  const conversionRate = interactions > 0 ? ((bottles / interactions) * 100).toFixed(1) : '0'

  const lines = [
    `EVENT: ${tasting.eventName}`,
    `STORE: ${storeLocation}`,
    `DATE: ${monthName} ${date.getDate()} (${dayName}, ${season}, Month ${month})`,
    `TIME: ${report.actualStartTime ?? 'unknown'} – ${report.actualEndTime ?? 'unknown'}`,
    '',
    'PERFORMANCE METRICS:',
    `- Samples served: ${report.samplesServed ?? 0}`,
    `- Consumer interactions: ${interactions}`,
    `- Bottles sold: ${bottles}`,
    `- Cases sold: ${report.casesSold ?? 0}`,
    `- Conversion rate: ${conversionRate}% (bottles sold per interaction)`,
    '',
    'TASTER NOTES:',
    report.highlights ? `- Highlights: ${report.highlights}` : '- Highlights: none provided',
    report.issues ? `- Issues/constraints: ${report.issues}` : '- Issues: none reported',
    report.accountFeedback ? `- Account feedback: ${report.accountFeedback}` : '- Account feedback: none provided',
  ]

  return lines.join('\n')
}

const ANALYSIS_PROMPT = `You are a brand ambassador tasting event performance analyst for Wisher Vodka, a craft vodka brand distributed by AHAWC.

Analyze the tasting event data below (and any photos provided) to give the team actionable intelligence for improving future tastings.

Focus your analysis on:
- SETUP QUALITY: Is the tasting table professional, branded, and visually appealing? (from photos if available)
- SHELF PRESENCE: Is Wisher Vodka well-positioned and visible on-shelf? (from shelf photos if available)
- CONVERSION PERFORMANCE: How effective was the taster at converting interactions into sales?
- TIME OF DAY: Was the timing optimal for this store type and location?
- SEASONALITY: Is this the right time of year for this store? Are there seasonal opportunities?
- LOCATION FIT: Does this store type match Wisher Vodka's target demographic?

SCORING GUIDE:
- setupScore 0-100: 0=no setup visible/terrible, 50=adequate, 80+=branded and professional (null if no setup photo)
- shelfScore 0-100: 0=not on shelf/terrible, 50=present but poor, 80+=premium placement (null if no shelf photos)
- overallScore 0-100: weighted combination of all factors
- conversionRating: "high" (>20% bottles/interactions), "medium" (10-20%), "low" (<10%), "none" (0 bottles)

Return ONLY valid JSON:
{
  "summary": "2-4 sentence overview of event performance and key takeaways",
  "setupScore": number or null,
  "shelfScore": number or null,
  "overallScore": number,
  "conversionRating": "high" | "medium" | "low" | "none",
  "insights": {
    "setup": "one sentence on table setup and presentation",
    "shelfPresence": "one sentence on Wisher shelf visibility and positioning",
    "conversion": "one sentence on sales conversion rate and what drove/limited it",
    "timeOfDay": "one sentence on timing effectiveness",
    "seasonality": "one sentence on seasonal suitability and opportunities",
    "location": "one sentence on store fit for Wisher Vodka"
  },
  "recommendations": ["specific action 1", "specific action 2", "specific action 3"]
}`

interface GPTResult {
  summary: string
  setupScore: number | null
  shelfScore: number | null
  overallScore: number
  conversionRating: string
  insights: Record<string, string>
  recommendations: string[]
}

async function callGPT4o(
  contextBlock: string,
  imageUrls: string[],
  priorAnalysis: TastingAnalysis | null,
): Promise<GPTResult> {
  const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = []

  for (const url of imageUrls) {
    const accessibleUrl = await getAccessibleUrl(url)
    if (accessibleUrl) {
      imageContent.push({ type: 'image_url', image_url: { url: accessibleUrl, detail: 'high' } })
    }
  }

  let prompt = ANALYSIS_PROMPT + '\n\nEVENT DATA:\n' + contextBlock

  if (priorAnalysis) {
    prompt += `\n\nPRIOR TASTING DATA FOR THIS STORE (for trend comparison only):
- Overall score: ${priorAnalysis.overallScore ?? 'unknown'}
- Conversion rating: ${priorAnalysis.conversionRating ?? 'unknown'}
- Setup score: ${priorAnalysis.setupScore ?? 'unknown'}
Include a "trend" field in your JSON: "improving" | "stable" | "declining" | "no_prior_data"
Include a "trendNotes" field (1-2 sentences on what changed vs the prior visit).`
  } else {
    prompt += '\n\nNo prior tasting data exists for this store.'
  }

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...imageContent,
    { type: 'text', text: prompt },
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [{ role: 'user', content }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in GPT-4o response')
  return JSON.parse(jsonMatch[0]) as GPTResult
}

export async function analyzeTastingReport(
  tastingId: string,
): Promise<TastingAnalysis | { error: string }> {
  await requireAdminOrStaff()

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tastingId))
    .limit(1)

  if (!tasting) return { error: 'Tasting not found.' }

  const [report] = await db
    .select()
    .from(tastingReports)
    .where(eq(tastingReports.tastingId, tastingId))
    .limit(1)

  if (!report) return { error: 'No report submitted for this tasting yet.' }

  const allImageUrls: string[] = [
    ...(report.setupPhotoUrl ? [report.setupPhotoUrl] : []),
    ...(report.shelfPhotoUrls ?? []),
  ]

  // Get most recent prior completed analysis for same store
  let priorAnalysis: TastingAnalysis | null = null
  const priors = await db
    .select()
    .from(tastingAnalyses)
    .where(
      and(
        eq(tastingAnalyses.tastingId, tastingId),
        ne(tastingAnalyses.tastingId, tastingId), // placeholder – we query by customerId below
      ),
    )
    .limit(0) // dummy — we re-query properly below

  // Actually query by customerId via join
  if (tasting.customerId) {
    const priorRows = await db
      .select({ a: tastingAnalyses })
      .from(tastingAnalyses)
      .innerJoin(tastings, eq(tastingAnalyses.tastingId, tastings.id))
      .where(
        and(
          eq(tastings.customerId, tasting.customerId),
          eq(tastingAnalyses.status, 'complete'),
          ne(tastingAnalyses.tastingId, tastingId),
        ),
      )
      .orderBy(desc(tastingAnalyses.createdAt))
      .limit(1)

    priorAnalysis = priorRows[0]?.a ?? null
  }

  void priors // suppress unused warning

  const [pending] = await db
    .insert(tastingAnalyses)
    .values({
      tastingId,
      imageUrls: allImageUrls,
      status: 'pending',
    })
    .returning()

  try {
    const contextBlock = buildContextBlock(
      {
        eventName: tasting.eventName,
        scheduledAt: tasting.scheduledAt,
        storeAddress: tasting.storeAddress,
        storeCity: tasting.storeCity,
        storeState: tasting.storeState,
      },
      {
        actualStartTime: report.actualStartTime,
        actualEndTime: report.actualEndTime,
        samplesServed: report.samplesServed,
        bottlesSold: report.bottlesSold,
        casesSold: report.casesSold,
        consumerInteractions: report.consumerInteractions,
        accountFeedback: report.accountFeedback,
        highlights: report.highlights,
        issues: report.issues,
      },
    )

    const result = await callGPT4o(contextBlock, allImageUrls, priorAnalysis)
    const trend = (result as unknown as { trend?: string }).trend ?? (priorAnalysis ? 'stable' : 'no_prior_data')
    const trendNotes = (result as unknown as { trendNotes?: string }).trendNotes ?? null

    const [updated] = await db
      .update(tastingAnalyses)
      .set({
        status: 'complete',
        summary: result.summary,
        setupScore: result.setupScore,
        shelfScore: result.shelfScore,
        overallScore: result.overallScore,
        conversionRating: result.conversionRating,
        insights: result.insights,
        recommendations: result.recommendations,
        trend,
        trendNotes,
      })
      .where(eq(tastingAnalyses.id, pending.id))
      .returning()

    return updated
  } catch (e) {
    const [errored] = await db
      .update(tastingAnalyses)
      .set({ status: 'error', errorMessage: String(e) })
      .where(eq(tastingAnalyses.id, pending.id))
      .returning()
    return errored
  }
}

export async function getTastingAnalysesForTastings(tastingIds: string[]): Promise<TastingAnalysis[]> {
  if (!tastingIds.length) return []
  const rows = await db
    .select()
    .from(tastingAnalyses)
    .where(
      and(
        inArray(tastingAnalyses.tastingId, tastingIds),
        eq(tastingAnalyses.status, 'complete'),
      ),
    )
    .orderBy(desc(tastingAnalyses.createdAt))

  const seen = new Set<string>()
  return rows.filter(r => {
    if (seen.has(r.tastingId)) return false
    seen.add(r.tastingId)
    return true
  })
}
