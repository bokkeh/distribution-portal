/** Fail before creating a campaign or contacting the sending API. */
export function validateRecipeEmailConfig(env: Record<string, string | undefined>) {
  for (const key of ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'COMMUNITY_EMAIL_REPLY_TO', 'COMMUNITY_EMAIL_MAILING_ADDRESS']) {
    if (!env[key]?.trim()) throw new Error(`${key} is required for weekly recipe emails`)
  }
  if (!(env.COMMUNITY_EMAIL_SECRET ?? env.NEXTAUTH_SECRET ?? env.AUTH_SECRET)?.trim()) {
    throw new Error('An unsubscribe signing secret is required for weekly recipe emails')
  }
  const url = new URL(env.NEXTAUTH_URL ?? 'https://portal.ahawc.com')
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || /^(localhost|127\.|\[::1\])/.test(url.hostname)) {
    throw new Error('NEXTAUTH_URL must be a public HTTPS origin for email unsubscribe links')
  }
  const mailbox = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/
  const from = (env.COMMUNITY_EMAIL_FROM ?? env.RESEND_FROM_EMAIL)?.trim()
  if (!from) throw new Error('COMMUNITY_EMAIL_FROM or RESEND_FROM_EMAIL is required for weekly recipe emails')
  const address = from.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? from
  if (!mailbox.test(address) || !mailbox.test(env.COMMUNITY_EMAIL_REPLY_TO!.trim())) {
    throw new Error('Recipe email From and Reply-To must contain valid email addresses')
  }
}
