import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { smsSubscriptions } from '@/db/schema'

export const SMS_CONSENT_COPY = 'By providing your phone number, you agree to receive SMS wholesale account updates and onboarding messages from AHAWC. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for help. We will not share mobile information with third parties for promotional or marketing purposes.'

export const SMS_CONFIRMATION_MESSAGE = 'AHAWC: You are subscribed to wholesale account updates and onboarding messages. Message frequency may vary. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.'
export const SMS_START_MESSAGE = 'AHAWC: SMS updates have been re-enabled for wholesale account updates and onboarding messages. Message frequency may vary. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.'
export const SMS_STOP_MESSAGE = 'AHAWC: You have successfully opted out and will receive no further messages. Reply START to opt back in.'
export const SMS_HELP_MESSAGE = 'AHAWC: For help with wholesale account updates and onboarding messages, reply to this message or email admin@ahawc.com. Reply STOP to opt out.'

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])
const HELP_KEYWORDS = new Set(['HELP', 'INFO'])
const START_KEYWORDS = new Set(['START', 'UNSTOP', 'YES'])

export function normalizePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, '')
  if (/^\+1\d{10}$/.test(digits)) return digits
  if (/^1\d{10}$/.test(digits)) return `+${digits}`
  if (/^\d{10}$/.test(digits)) return `+1${digits}`
  if (/^\+\d{11,15}$/.test(digits)) return digits
  throw new Error('Enter a valid phone number')
}

export function detectSmsKeyword(message: string): 'stop' | 'help' | 'start' | null {
  const normalized = message.trim().toUpperCase().replace(/[^\w]/g, '')
  if (!normalized) return null
  if (STOP_KEYWORDS.has(normalized)) return 'stop'
  if (HELP_KEYWORDS.has(normalized)) return 'help'
  if (START_KEYWORDS.has(normalized)) return 'start'
  return null
}

export async function getSmsSubscription(phoneNormalized: string) {
  const [subscription] = await db
    .select()
    .from(smsSubscriptions)
    .where(eq(smsSubscriptions.phoneNormalized, phoneNormalized))
    .limit(1)
  return subscription ?? null
}

export async function setSmsSubscription({
  phoneNormalized,
  status,
  source,
  consentLanguage,
  lastKeyword,
}: {
  phoneNormalized: string
  status: 'subscribed' | 'unsubscribed'
  source: string
  consentLanguage?: string | null
  lastKeyword?: string | null
}) {
  const now = new Date()
  await db.insert(smsSubscriptions).values({
    phoneNormalized,
    status,
    source,
    consentLanguage: consentLanguage ?? null,
    lastKeyword: lastKeyword ?? null,
    optedInAt: status === 'subscribed' ? now : null,
    optedOutAt: status === 'unsubscribed' ? now : null,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: smsSubscriptions.phoneNormalized,
    set: {
      status,
      source,
      consentLanguage: consentLanguage ?? null,
      lastKeyword: lastKeyword ?? null,
      optedInAt: status === 'subscribed' ? now : null,
      optedOutAt: status === 'unsubscribed' ? now : null,
      updatedAt: now,
    },
  })
}

export async function isSmsBlocked(phoneNormalized: string) {
  const subscription = await getSmsSubscription(phoneNormalized)
  return subscription?.status === 'unsubscribed'
}
