export function emailIdentity(env: Record<string, string | undefined>) {
  return { sender: env.RESEND_FROM_EMAIL?.trim() || null, replyTo: env.RESEND_REPLY_TO_EMAIL?.trim() || null }
}
export function escapeEmailHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
