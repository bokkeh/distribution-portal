import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const payloadSchema = z.object({ sendId: z.uuid(), contactId: z.uuid(), kind: z.enum(['open', 'click']), url: z.string().max(4000).optional() })
export type RecipeTrackingPayload = z.infer<typeof payloadSchema>

function signature(value: string) {
  const secret = (process.env.COMMUNITY_EMAIL_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET)?.trim()
  if (!secret) throw new Error('An email signing secret is required for recipe tracking.')
  return createHmac('sha256', secret).update(`recipe-engagement-v1:${value}`).digest('base64url')
}

function safeTarget(value: string | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.pathname.startsWith('/api/community/')
  } catch { return false }
}

export function createRecipeTrackingToken(payload: RecipeTrackingPayload) {
  const parsed = payloadSchema.parse(payload)
  if (parsed.kind === 'click' && !safeTarget(parsed.url)) throw new Error('Invalid recipe email destination.')
  const body = Buffer.from(JSON.stringify(parsed)).toString('base64url')
  return `${body}.${signature(body)}`
}

export function resolveRecipeTrackingToken(token: string): RecipeTrackingPayload | null {
  if (token.length > 10000) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  try {
    const expected = Buffer.from(signature(parts[0]))
    const provided = Buffer.from(parts[1])
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null
    const result = payloadSchema.safeParse(JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')))
    if (!result.success || (result.data.kind === 'click' && !safeTarget(result.data.url))) return null
    return result.data
  } catch { return null }
}

/** Preview and unsubscribe links are never tracked. Plain-text messages support click tracking too. */
export function trackRecipeEmailContent<T extends { html: string; text: string }>(content: T, context: { sendId: string; contactId: string; origin: string }): T {
  const origin = new URL(context.origin)
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('Recipe tracking requires an HTTPS origin.')
  const link = (url: string) => {
    if (!safeTarget(url)) return url
    const token = createRecipeTrackingToken({ sendId: context.sendId, contactId: context.contactId, kind: 'click', url })
    return `${origin.origin}/api/community/email/click?token=${token}`
  }
  const pixel = `${origin.origin}/api/community/email/open?token=${createRecipeTrackingToken({ sendId: context.sendId, contactId: context.contactId, kind: 'open' })}`
  const html = content.html.replace(/href="([^"]+)"/g, (match, href: string) => {
    const decoded = href.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    const tracked = link(decoded)
    return tracked === decoded ? match : `href="${tracked}"`
  }).replace('</body>', `<img src="${pixel}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" /></body>`)
  return { ...content, html, text: content.text.replace(/https:\/\/[^\s<>]+/g, link) }
}

