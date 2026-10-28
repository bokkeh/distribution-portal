import { getManagedRecipes, getExplicitRecipe } from './managed-recipes'
import { seasonalRecipePool } from './recipe-selection'
import { and, count, desc, eq, gt, lt, ne, or, sql } from 'drizzle-orm'
import { Resend } from 'resend'
import { validateRecipeEmailConfig } from '@/lib/marketing/recipe-email-config'
import { db } from '@/db'
import { communityContactCommunications, communityContacts, communityRecipeEmails } from '@/db/schema'
import { createCommunityUnsubscribeToken } from '@/lib/marketing/community-unsubscribe-token'
import { fetchWisherRecipes, type WisherRecipe } from '@/lib/marketing/wisher-recipes'

/** A recipe is never re-sent while it is one of the last N emails (this also rules out back-to-back repeats). */
export const RECIPE_NO_REPEAT_WINDOW = 5
const BATCH_SIZE = 100
export const WEEKLY_RECIPE_TAG = 'weekly_recipe'

const ORDER_URL = 'https://pstreetwines.com/product/wisher-vodka-750-ml/'
const WISHER_HOME_URL = 'https://wishervodka.com/'
const UTM = 'utm_source=community&utm_medium=email&utm_campaign=weekly_recipe'

const COLORS = {
  page: '#f4efe6',
  card: '#ffffff',
  ink: '#161412',
  muted: '#6b6359',
  accent: '#8a1c3b',
  rule: '#e8dfd0',
  soft: '#faf6ef',
}

const INTROS = [
  'Here’s this week’s pour from the Wisher bar: easy to make, easier to share.',
  'Fresh from the Wisher recipe book, a cocktail worth making this weekend.',
  'Your weekly Wisher pour is here. Grab a shaker and a friend.',
  'A little something to stir up this week, made with Wisher.',
]

const SUBJECTS = [
  (title: string) => `Cocktail of the week: ${title}`,
  (title: string) => `This week’s Wisher pour: ${title}`,
  (title: string) => `Your weekend cocktail: the ${title}`,
  (title: string) => `Shake this one up: ${title}`,
]

function portalUrl(path: string) {
  const base = process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function withUtm(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${UTM}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function easternIsoDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Monday of the Eastern-time week containing `date`, as YYYY-MM-DD. */
export function getRecipeWeekKey(date: Date) {
  const day = new Date(`${easternIsoDate(date)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  return day.toISOString().slice(0, 10)
}

function hash(value: string) {
  let result = 0
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0
  return result
}

/**
 * Picks the recipe for `weekKey`: never one of the last RECIPE_NO_REPEAT_WINDOW sends, preferring recipes
 * never sent, then the ones sent longest ago. Ties are broken by a stable per-week shuffle.
 * `history` must be ordered newest first.
 */
export function selectNextRecipe(recipes: WisherRecipe[], history: Array<{ recipeHandle: string }>, weekKey: string, date = weekKey) {
  recipes = seasonalRecipePool(recipes, date)
  if (!recipes.length) return null

  const lastSentIndex = new Map<string, number>()
  history.forEach((row, index) => {
    if (!lastSentIndex.has(row.recipeHandle)) lastSentIndex.set(row.recipeHandle, index)
  })

  const blocked = new Set(history.slice(0, RECIPE_NO_REPEAT_WINDOW).map((row) => row.recipeHandle))
  let candidates = recipes.filter((recipe) => !blocked.has(recipe.handle))
  // Only reachable if the catalog shrinks to the window size; still never repeat last week's recipe.
  if (!candidates.length) candidates = recipes.filter((recipe) => recipe.handle !== history[0]?.recipeHandle)
  if (!candidates.length) candidates = recipes

  const recency = (recipe: WisherRecipe) => lastSentIndex.get(recipe.handle) ?? Number.POSITIVE_INFINITY
  return [...candidates].sort((a, b) =>
    recency(b) - recency(a) || hash(`${weekKey}:${a.handle}`) - hash(`${weekKey}:${b.handle}`),
  )[0]
}

function displayTitle(recipe: WisherRecipe) {
  return recipe.title.split(',')[0].trim()
}

function renderButton(label: string, href: string, variant: 'solid' | 'outline' | 'light') {
  const styles = {
    solid: { bg: COLORS.accent, fg: '#ffffff', border: COLORS.accent },
    outline: { bg: COLORS.card, fg: COLORS.ink, border: COLORS.ink },
    light: { bg: '#ffffff', fg: COLORS.ink, border: '#ffffff' },
  }[variant]
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td align="center" bgcolor="${styles.bg}" style="border-radius:999px;border:1.5px solid ${styles.border};">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.02em;color:${styles.fg};text-decoration:none;border-radius:999px;">${label}</a>
        </td>
      </tr>
    </table>`
}

function renderSectionLabel(label: string) {
  return `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.accent};">${label}</p>`
}

export type WeeklyRecipeEmailContent = {
  subject: string
  preheader: string
  html: string
  text: string
}

export function renderWeeklyRecipeEmail({
  recipe,
  firstName,
  unsubscribeUrl,
  sendDate,
  variant,
}: {
  recipe: WisherRecipe
  firstName?: string | null
  unsubscribeUrl: string
  sendDate: Date
  /** Rotates subject and intro copy so consecutive emails don't read identically. */
  variant: number
}): WeeklyRecipeEmailContent {
  const title = displayTitle(recipe)
  const isPitcher = /pitcher/i.test(recipe.title)
  const subject = SUBJECTS[variant % SUBJECTS.length](title)
  const intro = INTROS[variant % INTROS.length]
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi there,'
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' }).format(sendDate)
  const preheader = `${title}${isPitcher ? ', a pitcher cocktail for the crew' : ''}. Ingredients, method, and where to grab a bottle of Wisher.`
  const recipeUrl = withUtm(recipe.url)
  const orderUrl = withUtm(ORDER_URL)
  const mailingAddress = process.env.COMMUNITY_EMAIL_MAILING_ADDRESS?.trim()

  const ingredientsHtml = recipe.ingredientGroups.map((group, groupIndex) => `
    ${group.heading ? `<p style="margin:${groupIndex ? '20px' : '0'} 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-style:italic;color:${COLORS.ink};">${escapeHtml(group.heading)}</p>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${group.items.map((item) => `
        <tr>
          <td width="18" valign="top" style="padding:7px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:${COLORS.accent};">&bull;</td>
          <td valign="top" style="padding:7px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:${COLORS.ink};border-bottom:1px solid ${COLORS.rule};">${escapeHtml(item)}</td>
        </tr>`).join('')}
    </table>`).join('')

  const stepsHtml = recipe.steps.map((step, index) => `
    <tr>
      <td width="40" valign="top" style="padding:0 0 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="center" valign="middle" width="28" height="28" bgcolor="${COLORS.ink}" style="width:28px;height:28px;border-radius:14px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;">${index + 1}</td>
        </tr></table>
      </td>
      <td valign="top" style="padding:3px 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:${COLORS.ink};">${escapeHtml(step)}</td>
    </tr>`).join('')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media (max-width: 620px) {
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .title { font-size: 30px !important; line-height: 36px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.page};">${escapeHtml(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.page}" style="background:${COLORS.page};">
    <tr>
      <td align="center" style="padding:32px 12px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="${withUtm(WISHER_HOME_URL)}" target="_blank"><img src="${portalUrl('/brand/wisher-logo.png')}" width="170" alt="Wisher" style="display:block;width:170px;max-width:170px;height:auto;border:0;"></a>
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.card}" style="background:${COLORS.card};border-radius:18px;overflow:hidden;">
              ${recipe.imageUrl ? `<a href="${recipeUrl}" target="_blank"><img src="${escapeHtml(recipe.imageUrl)}" width="600" alt="${escapeHtml(recipe.title)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:18px 18px 0 0;"></a>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="px" style="padding:36px 44px 12px;">
                    <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.accent};">Cocktail of the week &middot; ${escapeHtml(dateLabel)}</p>
                    <h1 class="title" style="margin:0 0 ${isPitcher ? '12px' : '20px'};font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:42px;font-weight:normal;color:${COLORS.ink};">${escapeHtml(title)}</h1>
                    ${isPitcher ? `<p style="margin:0 0 20px;"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${COLORS.soft};border:1px solid ${COLORS.rule};font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;color:${COLORS.muted};">Pitcher cocktail &middot; made for sharing</span></p>` : ''}
                    <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:${COLORS.ink};">${escapeHtml(greeting)}</p>
                    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:${COLORS.muted};">${escapeHtml(intro)}</p>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:24px 44px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.soft}" style="background:${COLORS.soft};border-radius:14px;">
                      <tr><td style="padding:22px 24px 18px;">
                        ${renderSectionLabel('What you’ll need')}
                        ${ingredientsHtml}
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:28px 44px 8px;">
                    ${renderSectionLabel('How to make it')}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${stepsHtml}</table>
                  </td>
                </tr>
                <tr>
                  <td class="px" align="center" style="padding:4px 44px 40px;">
                    ${renderButton('See the recipe on wishervodka.com', recipeUrl, 'outline')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:16px;line-height:16px;font-size:16px;">&nbsp;</td></tr>
          <tr>
            <td bgcolor="${COLORS.ink}" align="center" class="px" style="background:${COLORS.ink};border-radius:18px;padding:36px 44px;">
              <p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#d9a7b6;">Stock the bar</p>
              <h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;font-weight:normal;color:#ffffff;">Out of Wisher? We’ve got you.</h2>
              <p style="margin:0 0 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#cfc8bf;">Order a 750 ml bottle of Wisher Vodka online from P Street Wines and have this week’s cocktail ready by the weekend.</p>
              ${renderButton('Order Wisher Vodka', orderUrl, 'light')}
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding:32px 44px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:${COLORS.muted};">
              <p style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;color:${COLORS.ink};">Cheers from all of us at Wisher.</p>
              <p style="margin:0 0 10px;">Please enjoy responsibly. You must be 21 or older to purchase alcohol.</p>
              <p style="margin:0 0 10px;">You’re receiving this because you joined the Wisher community.<br><a href="${unsubscribeUrl}" style="color:${COLORS.muted};text-decoration:underline;">Unsubscribe</a> &middot; <a href="${withUtm(WISHER_HOME_URL)}" style="color:${COLORS.muted};text-decoration:underline;">wishervodka.com</a></p>
              ${mailingAddress ? `<p style="margin:0;">${escapeHtml(mailingAddress)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `COCKTAIL OF THE WEEK · ${dateLabel}`,
    title,
    '',
    greeting,
    intro,
    '',
    'WHAT YOU’LL NEED',
    ...recipe.ingredientGroups.flatMap((group) => [...(group.heading ? ['', group.heading] : []), ...group.items.map((item) => `- ${item}`)]),
    '',
    'HOW TO MAKE IT',
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `Full recipe: ${recipeUrl}`,
    '',
    `Out of Wisher? Order a bottle online from P Street Wines: ${orderUrl}`,
    '',
    'Please enjoy responsibly. You must be 21 or older to purchase alcohol.',
    `Unsubscribe: ${unsubscribeUrl}`,
    ...(mailingAddress ? [mailingAddress] : []),
  ].join('\n')

  return { subject, preheader, html, text }
}

/** Sends that count toward rotation: anything that reached at least one inbox. Newest first. */
async function getRecipeSendHistory() {
  return db
    .select({ recipeHandle: communityRecipeEmails.recipeHandle })
    .from(communityRecipeEmails)
    .where(or(ne(communityRecipeEmails.status, 'failed'), gt(communityRecipeEmails.sentCount, 0)))
    .orderBy(desc(communityRecipeEmails.createdAt))
}

export async function buildWeeklyRecipePreview({ handle, now = new Date() }: { handle?: string | null; now?: Date } = {}) {
  // Previewing shouldn't require the migration; with no history the first pick is shown.
  const [recipes, history] = await Promise.all([getManagedRecipes(), getRecipeSendHistory().catch(() => [])])
  const weekKey = getRecipeWeekKey(now)
  const explicit = await getExplicitRecipe(`week:${weekKey}`, recipes, easternIsoDate(now))
  const recipe = handle ? recipes.find((item) => item.handle === handle && item.status !== 'draft') : explicit === undefined ? selectNextRecipe(recipes, history, weekKey, easternIsoDate(now)) : explicit
  if (!recipe) return null
  return {
    recipe,
    ...renderWeeklyRecipeEmail({ recipe, firstName: 'Friend', unsubscribeUrl: '#', sendDate: now, variant: history.length }),
  }
}

/**
 * Re-renders the email a past week's send used: same recipe, send date and subject/intro rotation.
 * Personal details are placeholders. Returns null if the week wasn't sent or the recipe left wishervodka.com.
 */
export async function buildSentRecipeEmailPreview(weekKey: string) {
  const [run] = await db.select().from(communityRecipeEmails).where(eq(communityRecipeEmails.weekKey, weekKey)).limit(1)
  if (!run) return null

  const [recipes, [earlier]] = await Promise.all([
    fetchWisherRecipes(),
    // The variant at send time was the number of counted sends before this one.
    db
      .select({ total: count() })
      .from(communityRecipeEmails)
      .where(and(
        lt(communityRecipeEmails.createdAt, run.createdAt),
        or(ne(communityRecipeEmails.status, 'failed'), gt(communityRecipeEmails.sentCount, 0)),
      )),
  ])
  const recipe = recipes.find((item) => item.handle === run.recipeHandle)
  if (!recipe) return null

  return {
    recipe,
    ...renderWeeklyRecipeEmail({ recipe, firstName: 'Friend', unsubscribeUrl: '#', sendDate: run.createdAt, variant: earlier?.total ?? 0 }),
  }
}

export type WeeklyRecipeSendResult =
  | { status: 'skipped'; reason: 'already_sent' | 'no_recipients' | 'no_recipes'; weekKey: string }
  | { status: 'sent' | 'failed'; weekKey: string; recipe: string; recipients: number; sent: number; failed: number }

export async function sendWeeklyRecipeEmail({ now = new Date() }: { now?: Date } = {}): Promise<WeeklyRecipeSendResult> {
  validateRecipeEmailConfig(process.env)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const weekKey = getRecipeWeekKey(now)

  const [existing] = await db
    .select({ id: communityRecipeEmails.id, status: communityRecipeEmails.status, sentCount: communityRecipeEmails.sentCount })
    .from(communityRecipeEmails)
    .where(eq(communityRecipeEmails.weekKey, weekKey))
    .limit(1)
  if (existing) {
    // A week where nothing went out (e.g. Resend outage) may be retried by the next cron run.
    if (existing.status !== 'failed' || existing.sentCount > 0) return { status: 'skipped', reason: 'already_sent', weekKey }
    await db.delete(communityRecipeEmails).where(eq(communityRecipeEmails.id, existing.id))
  }

  const [recipes, history, contacts] = await Promise.all([
    getManagedRecipes(),
    getRecipeSendHistory(),
    db
      .select({ id: communityContacts.id, firstName: communityContacts.firstName, email: communityContacts.email })
      .from(communityContacts)
      .where(and(eq(communityContacts.status, 'subscribed'), sql`trim(${communityContacts.email}) <> ''`)),
  ])
  if (!contacts.length) return { status: 'skipped', reason: 'no_recipients', weekKey }

  const explicit = await getExplicitRecipe(`week:${weekKey}`, recipes, easternIsoDate(now))
  const recipe = explicit === undefined ? selectNextRecipe(recipes, history, weekKey, easternIsoDate(now)) : explicit
  if (!recipe) return { status: 'skipped', reason: 'no_recipes', weekKey }

  const variant = history.length
  const subject = renderWeeklyRecipeEmail({ recipe, unsubscribeUrl: '#', sendDate: now, variant }).subject
  const [run] = await db
    .insert(communityRecipeEmails)
    .values({ weekKey, recipeHandle: recipe.handle, recipeTitle: recipe.title, recipeUrl: recipe.url, subject, recipientCount: contacts.length })
    .onConflictDoNothing({ target: communityRecipeEmails.weekKey })
    .returning({ id: communityRecipeEmails.id })
  if (!run) return { status: 'skipped', reason: 'already_sent', weekKey }

  const from = process.env.COMMUNITY_EMAIL_FROM ?? `Wisher Vodka <${process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com'}>`
  const replyTo = process.env.COMMUNITY_EMAIL_REPLY_TO
  let sent = 0
  let failed = 0
  let lastError: string | null = null

  for (let start = 0; start < contacts.length; start += BATCH_SIZE) {
    const batch = contacts.slice(start, start + BATCH_SIZE)
    const emails = batch.map((contact) => {
      const unsubscribeUrl = portalUrl(`/api/community/unsubscribe?token=${encodeURIComponent(createCommunityUnsubscribeToken(contact.id))}&w=${weekKey}`)
      const content = renderWeeklyRecipeEmail({ recipe, firstName: contact.firstName, unsubscribeUrl, sendDate: now, variant })
      return {
        from,
        to: [contact.email],
        subject: content.subject,
        html: content.html,
        text: content.text,
        ...(replyTo ? { replyTo } : {}),
        // Read back by the Resend webhook to attribute bounces and complaints to this week's send.
        tags: [
          { name: 'campaign', value: WEEKLY_RECIPE_TAG },
          { name: 'week', value: weekKey },
        ],
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }
    })

    let ok = false
    try {
      const result = await resend.batch.send(emails)
      if (result.error) throw new Error(result.error.message)
      ok = true
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Batch send failed'
      console.error('Weekly recipe email batch failed:', error)
    }
    if (ok) sent += batch.length
    else failed += batch.length

    try {
      await db.insert(communityContactCommunications).values(batch.map((contact) => ({
        communityContactId: contact.id,
        channel: 'email' as const,
        subject,
        body: `Weekly Wisher recipe: ${recipe.title} (${recipe.url})`,
        status: ok ? ('sent' as const) : ('failed' as const),
      })))
    } catch (error) {
      console.error('Failed to log weekly recipe email communications:', error)
    }
  }

  const status = sent > 0 ? 'sent' : 'failed'
  await db
    .update(communityRecipeEmails)
    .set({ status, sentCount: sent, failedCount: failed, error: lastError, completedAt: new Date() })
    .where(eq(communityRecipeEmails.id, run.id))

  return { status, weekKey, recipe: recipe.title, recipients: contacts.length, sent, failed }
}
