import { NextRequest, NextResponse } from 'next/server'
import { parseWeekKey, recordCommunityUnsubscribe } from '@/lib/marketing/community-email-events'
import { resolveContactIdFromUnsubscribeToken } from '@/lib/marketing/community-unsubscribe-token'

export const runtime = 'nodejs'

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#f4efe6;font-family:Helvetica,Arial,sans-serif;color:#161412;">
  <main style="max-width:440px;margin:0 auto;padding:64px 16px;text-align:center;">
    <img src="/brand/wisher-logo.png" width="150" alt="Wisher" style="display:inline-block;width:150px;height:auto;margin-bottom:32px;">
    <div style="background:#fff;border-radius:18px;padding:36px 28px;">
      <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;">${title}</h1>
      ${body}
    </div>
  </main>
</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

function invalidLink() {
  return page('Link not valid', '<p style="margin:0;color:#6b6359;line-height:1.5;">This unsubscribe link is invalid or has expired. Reply to any Wisher email and we’ll remove you right away.</p>', 400)
}

function resolveToken(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  try {
    return resolveContactIdFromUnsubscribeToken(token)
  } catch {
    return null
  }
}

// GET only shows a confirmation so link scanners that prefetch emails can't unsubscribe people.
export async function GET(request: NextRequest) {
  if (!resolveToken(request)) return invalidLink()
  const action = `/api/community/unsubscribe?${request.nextUrl.searchParams.toString()}`
  return page(
    'Unsubscribe from Wisher emails?',
    `<p style="margin:0 0 24px;color:#6b6359;line-height:1.5;">You’ll stop getting the weekly Wisher cocktail recipe and other community emails.</p>
     <form method="post" action="${action}"><button type="submit" style="border:0;border-radius:999px;background:#8a1c3b;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;cursor:pointer;">Unsubscribe</button></form>`,
  )
}

// Handles both the confirmation form and RFC 8058 one-click unsubscribe from mail clients.
export async function POST(request: NextRequest) {
  const contactId = resolveToken(request)
  if (!contactId) return invalidLink()

  // Mail clients send this exact form body for RFC 8058 one-click; our confirmation form sends none.
  const body = await request.text().catch(() => '')
  await recordCommunityUnsubscribe({
    contactId,
    reason: body.includes('List-Unsubscribe=One-Click') ? 'one_click' : 'link',
    weekKey: parseWeekKey(request.nextUrl.searchParams.get('w')),
  })

  return page('You’re unsubscribed', '<p style="margin:0;color:#6b6359;line-height:1.5;">You won’t receive any more Wisher community emails. Changed your mind? Sign up again anytime at wishervodka.com.</p>')
}
