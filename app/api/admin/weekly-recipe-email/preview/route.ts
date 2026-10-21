import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { buildWeeklyRecipePreview } from '@/lib/marketing/weekly-recipe-email'

export const runtime = 'nodejs'

/** Renders the next weekly recipe email without sending it. `?handle=` previews a specific recipe; `?format=text` shows the plain-text part. */
export async function GET(request: NextRequest) {
  await requireAdmin()
  const handle = request.nextUrl.searchParams.get('handle')
  const preview = await buildWeeklyRecipePreview({ handle })
  if (!preview) return NextResponse.json({ error: 'No recipe found' }, { status: 404 })

  if (request.nextUrl.searchParams.get('format') === 'text') {
    return new NextResponse(`Subject: ${preview.subject}\n\n${preview.text}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  return new NextResponse(preview.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
