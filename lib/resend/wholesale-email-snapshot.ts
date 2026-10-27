export function wholesaleEmailSnapshot({ to, subject, html, from, privateUrl, status }: {
  to: string[]; subject: string; html: string; from: string; privateUrl?: string; status: 'sent' | 'failed'
}) {
  return { to, subject, from, status, html: privateUrl ? html.replaceAll(privateUrl, '#activation-link-hidden') : html, activationLinkHidden: Boolean(privateUrl) }
}
