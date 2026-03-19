'use server'

import OpenAI from 'openai'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/db'
import { deliveryStops, shelfAnalyses } from '@/db/schema'
import type { ShelfAnalysis } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { generateSignedReadUrl } from '@/lib/gcs/client'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function extractGCSFilePath(publicUrl: string): string | null {
  const bucketName = process.env.GCS_BUCKET_NAME ?? ''
  const prefix = `https://storage.googleapis.com/${bucketName}/`
  if (publicUrl.startsWith(prefix)) return publicUrl.slice(prefix.length)
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

const ANALYSIS_PROMPT = `You are a retail shelf intelligence analyst for Wisher Vodka, a craft vodka brand distributed by AHAWC.

Analyze the shelf image(s) and return ONLY valid JSON. Rules:
- Report only what you can actually see. Do not invent brands, prices, or trends.
- Wisher Vodka has a distinctive craft label — look carefully for it.
- Shelf levels: "top" (overhead), "eye" (eye level), "mid" (below eye), "bottom" (floor), "unknown"
- Horizontal: "left", "center", "right", "unknown"
- Stock: "full", "medium", "low", "nearly_empty", "unknown"
- Confidence: "high" (Wisher clearly visible), "medium" (likely Wisher), "low" (uncertain or not found)
- Scores 0–100 where 100 is best-in-class execution

Return ONLY this JSON structure:
{
  "wisherDetected": boolean,
  "confidence": "high" | "medium" | "low",
  "summary": "2-4 sentence plain English summary of Wisher shelf presence and key observations",
  "shelfLevel": "top" | "eye" | "mid" | "bottom" | "unknown",
  "horizontalPosition": "left" | "center" | "right" | "unknown",
  "facings": number or null,
  "labelForward": boolean or null,
  "obstructionDetected": boolean or null,
  "detectedPrice": "string like $24.99" or null,
  "promoDetected": boolean,
  "stockLevel": "full" | "medium" | "low" | "nearly_empty" | "unknown",
  "competitors": ["Brand1", "Brand2"],
  "placementScore": 0-100,
  "visibilityScore": 0-100,
  "facingScore": 0-100,
  "overallScore": 0-100,
  "insights": {
    "placement": "one sentence",
    "facings": "one sentence",
    "competitive": "one sentence",
    "pricing": "one sentence or null if price not visible",
    "visibility": "one sentence",
    "promoSupport": "one sentence",
    "stock": "one sentence"
  },
  "recommendations": ["action 1", "action 2", "action 3"]
}`

interface ClaudeResult {
  wisherDetected: boolean
  confidence: string
  summary: string
  shelfLevel: string
  horizontalPosition: string
  facings: number | null
  labelForward: boolean | null
  obstructionDetected: boolean | null
  detectedPrice: string | null
  promoDetected: boolean
  stockLevel: string
  competitors: string[]
  placementScore: number
  visibilityScore: number
  facingScore: number
  overallScore: number
  insights: Record<string, string>
  recommendations: string[]
}

async function callGPT4oVision(imageUrls: string[], priorAnalysis: ShelfAnalysis | null): Promise<ClaudeResult> {
  const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = []

  for (const url of imageUrls) {
    const accessibleUrl = await getAccessibleUrl(url)
    if (accessibleUrl) {
      imageContent.push({ type: 'image_url', image_url: { url: accessibleUrl, detail: 'high' } })
    }
  }

  if (imageContent.length === 0) throw new Error('No images could be loaded for analysis')

  let prompt = ANALYSIS_PROMPT
  if (priorAnalysis) {
    prompt += `\n\nPRIOR VISIT DATA (use for trend comparison only, do not fabricate):
- Shelf level: ${priorAnalysis.shelfLevel ?? 'unknown'}
- Facings: ${priorAnalysis.facings ?? 'unknown'}
- Overall score: ${priorAnalysis.overallScore ?? 'unknown'}
- Promo detected: ${priorAnalysis.promoDetected ?? 'unknown'}
- Stock level: ${priorAnalysis.stockLevel ?? 'unknown'}`
  } else {
    prompt += '\n\nNo prior visit data exists for this store.'
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in GPT-4o response')
  return JSON.parse(jsonMatch[0]) as ClaudeResult
}

function computeTrend(
  result: ClaudeResult,
  prior: ShelfAnalysis | null,
): { trend: string; trendNotes: string | null } {
  if (!prior || prior.overallScore === null || result.overallScore === null) {
    return { trend: 'no_prior_data', trendNotes: null }
  }

  const delta = result.overallScore - (prior.overallScore ?? 0)
  let trend = delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable'
  const notes: string[] = []

  if (delta > 5) notes.push(`Overall score up ${delta} points.`)
  else if (delta < -5) notes.push(`Overall score down ${Math.abs(delta)} points.`)
  else notes.push('Performance consistent with prior visit.')

  if (prior.facings !== null && result.facings !== null && prior.facings !== result.facings) {
    const fd = result.facings - prior.facings
    notes.push(`Facings ${fd > 0 ? 'increased' : 'decreased'} by ${Math.abs(fd)}.`)
  }
  if (prior.shelfLevel && result.shelfLevel !== 'unknown' && prior.shelfLevel !== result.shelfLevel) {
    notes.push(`Shelf level changed from ${prior.shelfLevel} to ${result.shelfLevel}.`)
  }
  if (prior.promoDetected === true && !result.promoDetected) {
    notes.push('Promo support disappeared since last visit.')
  }

  return { trend, trendNotes: notes.join(' ') }
}

// Exported server action: trigger analysis for a stop
export async function analyzeShelfImages(
  deliveryStopId: string,
): Promise<ShelfAnalysis | { error: string }> {
  await requireAdminOrStaff()

  const [stop] = await db
    .select()
    .from(deliveryStops)
    .where(eq(deliveryStops.id, deliveryStopId))
    .limit(1)

  if (!stop) return { error: 'Delivery stop not found.' }

  const imageUrls = [stop.shelfPhotoUrl, stop.additionalPhotoUrl].filter(Boolean) as string[]
  if (imageUrls.length === 0) return { error: 'No shelf images found for this stop.' }

  // Get most recent prior COMPLETED analysis for the same store (for trend)
  let priorAnalysis: ShelfAnalysis | null = null
  if (stop.customerId) {
    const priors = await db
      .select()
      .from(shelfAnalyses)
      .where(
        and(
          eq(shelfAnalyses.customerId, stop.customerId),
          eq(shelfAnalyses.status, 'complete'),
          ne(shelfAnalyses.deliveryStopId, deliveryStopId),
        ),
      )
      .orderBy(desc(shelfAnalyses.createdAt))
      .limit(1)
    priorAnalysis = priors[0] ?? null
  }

  // Insert pending record
  const [pending] = await db
    .insert(shelfAnalyses)
    .values({
      deliveryId: stop.deliveryId,
      deliveryStopId: stop.id,
      customerId: stop.customerId,
      imageUrls,
      status: 'pending',
    })
    .returning()

  try {
    const result = await callGPT4oVision(imageUrls, priorAnalysis)
    const { trend, trendNotes } = computeTrend(result, priorAnalysis)

    const [updated] = await db
      .update(shelfAnalyses)
      .set({
        status: 'complete',
        confidence: result.confidence,
        summary: result.summary,
        wisherDetected: result.wisherDetected,
        shelfLevel: result.shelfLevel,
        horizontalPosition: result.horizontalPosition,
        facings: result.facings,
        labelForward: result.labelForward,
        obstructionDetected: result.obstructionDetected,
        detectedPrice: result.detectedPrice,
        promoDetected: result.promoDetected,
        stockLevel: result.stockLevel,
        competitors: result.competitors,
        placementScore: result.placementScore,
        visibilityScore: result.visibilityScore,
        facingScore: result.facingScore,
        overallScore: result.overallScore,
        insights: result.insights,
        recommendations: result.recommendations,
        trend,
        trendNotes,
      })
      .where(eq(shelfAnalyses.id, pending.id))
      .returning()

    return updated
  } catch (e) {
    const [errored] = await db
      .update(shelfAnalyses)
      .set({ status: 'error', errorMessage: String(e) })
      .where(eq(shelfAnalyses.id, pending.id))
      .returning()
    return errored
  }
}

// Server-side helper to fetch existing analyses for a batch of stop IDs
export async function getShelfAnalysesForStops(stopIds: string[]): Promise<ShelfAnalysis[]> {
  if (!stopIds.length) return []
  const rows = await db
    .select()
    .from(shelfAnalyses)
    .where(
      and(
        inArray(shelfAnalyses.deliveryStopId, stopIds),
        eq(shelfAnalyses.status, 'complete'),
      ),
    )
    .orderBy(desc(shelfAnalyses.createdAt))

  // Keep only the most recent per stop
  const seen = new Set<string>()
  return rows.filter(r => {
    if (seen.has(r.deliveryStopId)) return false
    seen.add(r.deliveryStopId)
    return true
  })
}
