import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { SimpleProfileForm } from '@/components/profile/SimpleProfileForm'
import { requireFeature } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Stripe from 'stripe'
import { createTasterStripeOnboardingLink } from '@/actions/profile'
import { getUserPreferences } from '@/lib/preferences/read'

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

function isMissingStripeConnectColumn(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('stripe_connect_account_id') || message.includes('42703')
}

export default async function TasterProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; error?: string; onboarding?: string }>
}) {
  const session = await requireFeature('profile', 'taster', 'admin')
  const query = await searchParams
  const preferences = await getUserPreferences(session.user.id)

  let user: {
    id: string
    name: string
    email: string
    phone: string | null
    avatarUrl: string | null
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    stripeConnectAccountId: string | null
  } | undefined

  try {
    ;[user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        address: users.address,
        city: users.city,
        state: users.state,
        zip: users.zip,
        stripeConnectAccountId: users.stripeConnectAccountId,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
  } catch (error) {
    if (!isMissingStripeConnectColumn(error)) throw error

    ;[user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        address: users.address,
        city: users.city,
        state: users.state,
        zip: users.zip,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .then(rows => rows.map(row => ({ ...row, stripeConnectAccountId: null })))
  }

  if (!user) notFound()

  let payoutStatusLabel = 'Not connected'
  let payoutStatusTone = 'text-amber-700'

  if (user.stripeConnectAccountId) {
    try {
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId)
      if (account.payouts_enabled) {
        payoutStatusLabel = 'Ready for payouts'
        payoutStatusTone = 'text-emerald-700'
      } else if (account.details_submitted) {
        payoutStatusLabel = 'Pending Stripe review'
        payoutStatusTone = 'text-blue-700'
      } else {
        payoutStatusLabel = 'Needs onboarding'
      }
    } catch {
      payoutStatusLabel = 'Connection needs attention'
      payoutStatusTone = 'text-red-700'
    }
  }

  return (
    <div className="space-y-6">
      {query.onboarding === '1' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Complete your profile and save your settings before entering the taster portal.
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-muted-foreground mt-1">Keep your phone number current so tasting assignments reach you by text.</p>
      </div>
      <SimpleProfileForm user={user} preferences={preferences} />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Stripe Payouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Connect Stripe so AHAWC can pay approved tasting invoices out to you.</p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <p className="text-slate-500">Current status</p>
            <p className={`font-medium ${payoutStatusTone}`}>{payoutStatusLabel}</p>
          </div>
          {query.stripe === 'return' ? (
            <p className="text-sm text-emerald-700">Stripe onboarding returned successfully. If Stripe still needs more details, you can reopen onboarding below.</p>
          ) : null}
          {query.stripe === 'refresh' ? (
            <p className="text-sm text-amber-700">Stripe asked to refresh the onboarding flow. Reopen it below to continue.</p>
          ) : null}
          {query.error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              {query.error}
            </p>
          ) : null}
          <form action={createTasterStripeOnboardingLink}>
            <Button type="submit" className="w-full">
              {user.stripeConnectAccountId ? 'Open Stripe Payout Setup' : 'Connect Stripe for Payouts'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
