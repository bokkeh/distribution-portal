import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { parseWeekKey } from '@/lib/marketing/community-email-events'
import { buildSentRecipeEmailPreview, buildWeeklyRecipePreview } from '@/lib/marketing/weekly-recipe-email'

export const runtime = 'nodejs'

/**
 * Renders the next weekly recipe email without sending it. `?week=YYYY-MM-DD` shows a past week's email,
 * `?handle=` previews a specific recipe, and `?format=text` shows the plain-text part.
 */
export async function GET(request: NextRequest) {
  await requireAdmin()
  const params = request.nextUrl.searchParams
  const week = parseWeekKey(params.get('week'))
  const preview = week
    ? await buildSentRecipeEmailPreview(week)
    : await buildWeeklyRecipePreview({ handle: params.get('handle') })
  if (!preview) {
    return NextResponse.json(
      { error: week ? 'No email was sent that week, or its recipe is no longer on wishervodka.com' : 'No recipe found' },
      { status: 404 },
    )
  }

  if (params.get('format') === 'text') {
    return new NextResponse(`Subject: ${preview.subject}\n\n${preview.text}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  return new NextResponse(preview.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
