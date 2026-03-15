'use server'

import { db } from '@/db'
import { users, customerAccounts, drivers } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateSignedUploadUrl } from '@/lib/gcs/client'
import { geocodeAddress } from '@/lib/maps/geocode'
import { upsertHubSpotContact, updateHubSpotCompany } from '@/lib/hubspot/client'
import { v4 as uuidv4 } from 'uuid'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', { apiVersion: '2026-02-25.clover' })

function isMissingUserAddressColumn(error: unknown) {
  const dbError = error as { code?: string; message?: string; cause?: unknown } | null
  const code = dbError?.code ?? (dbError?.cause as { code?: string } | undefined)?.code
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return code === '42703' || message.includes('address') || message.includes('city') || message.includes('state') || message.includes('zip')
}

function isMissingStripeConnectColumn(error: unknown) {
  const dbError = error as { code?: string; message?: string; cause?: unknown } | null
  const code = dbError?.code ?? (dbError?.cause as { code?: string } | undefined)?.code
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return code === '42703' || message.includes('stripe_connect_account_id')
}

export async function updateProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    // Update user record
    try {
      await db.update(users).set({
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string) || null,
        avatarUrl: (formData.get('avatarUrl') as string) || null,
        address: (formData.get('address') as string) || null,
        city: (formData.get('city') as string) || null,
        state: (formData.get('state') as string) || null,
        zip: (formData.get('zip') as string) || null,
      }).where(eq(users.id, userId))
    } catch (error) {
      if (!isMissingUserAddressColumn(error)) throw error

      await db.update(users).set({
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string) || null,
        avatarUrl: (formData.get('avatarUrl') as string) || null,
      }).where(eq(users.id, userId))
    }

    // Update customer account if it exists
    const accountId = formData.get('accountId') as string | null
    if (accountId) {
      const companyName = (formData.get('companyName') as string) || ''
      const address = (formData.get('address') as string) || null
      const city = (formData.get('city') as string) || null
      const state = (formData.get('state') as string) || null
      const zip = (formData.get('zip') as string) || null
      const email = (formData.get('email') as string) || null
      const phone = (formData.get('phone') as string) || null
      const businessEmail = (formData.get('businessEmail') as string) || null
      const businessPhone = (formData.get('businessPhone') as string) || null
      const pocName = (formData.get('pocName') as string) || null
      const pocPhone = (formData.get('pocPhone') as string) || null
      const pocEmail = (formData.get('pocEmail') as string) || null

      await db.update(customerAccounts).set({
        companyName: companyName || undefined,
        contactName: pocName || (formData.get('name') as string) || null,
        address,
        city,
        state,
        zip,
        phone: businessPhone || phone,
        email,
        dcAbraNumber: (formData.get('dcAbraNumber') as string) || null,
        businessEmail,
        businessPhone,
        notificationPreference: (formData.get('notificationPreference') as string) || 'email',
        pocName,
        pocPhone,
        pocEmail,
        hoursOfOperation: (formData.get('hoursOfOperation') as string) || null,
        preferredDeliveryDays: (formData.get('preferredDeliveryDays') as string) || null,
        preferredDeliveryTimes: (formData.get('preferredDeliveryTimes') as string) || null,
        additionalLocations: (formData.get('additionalLocations') as string) || null,
      }).where(eq(customerAccounts.id, accountId))

      const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)

      if (account) {
        const hubspotContactId = await upsertHubSpotContact({
          email: pocEmail || businessEmail || email || '',
          firstname: (pocName || formData.get('name') as string || companyName).split(' ')[0] ?? companyName,
          lastname: (pocName || formData.get('name') as string || '').split(' ').slice(1).join(' '),
          company: companyName,
          phone: pocPhone || businessPhone || phone || '',
          city: city ?? '',
          state: state ?? '',
          credit_limit: account.creditLimit ?? '0',
          payment_terms: account.paymentTerms ?? 'NET30',
          account_balance: account.balance ?? '0',
        }).catch(() => null)

        if (hubspotContactId) {
          await db.update(customerAccounts).set({ hubspotContactId }).where(eq(customerAccounts.id, accountId))
        }

        if (account.hubspotCompanyId) {
          await updateHubSpotCompany(account.hubspotCompanyId, {
            name: companyName,
            phone: businessPhone || phone || '',
            address: address ?? '',
            city: city ?? '',
            state: state ?? '',
            zip: zip ?? '',
          }).catch(() => false)
        }
      }
    }

    revalidatePath('/customer/profile')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateSimpleProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    try {
      await db.update(users).set({
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string) || null,
        avatarUrl: (formData.get('avatarUrl') as string) || null,
        address: (formData.get('address') as string) || null,
        city: (formData.get('city') as string) || null,
        state: (formData.get('state') as string) || null,
        zip: (formData.get('zip') as string) || null,
      }).where(eq(users.id, userId))
    } catch (error) {
      if (!isMissingUserAddressColumn(error)) throw error

      await db.update(users).set({
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string) || null,
        avatarUrl: (formData.get('avatarUrl') as string) || null,
      }).where(eq(users.id, userId))
    }

    revalidatePath('/admin/profile')
    revalidatePath('/staff/profile')
    revalidatePath('/taster/profile')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function createTasterStripeOnboardingLink() {
  const session = await requireAuth()
  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('taster') && !roles.includes('admin')) throw new Error('Unauthorized')

  if (!process.env.STRIPE_SECRET_KEY) {
    redirect('/taster/profile?error=' + encodeURIComponent('Stripe is not configured yet.'))
  }

  let user:
    | {
        id: string
        email: string
        name: string | null
        stripeConnectAccountId: string | null
      }
    | undefined

  try {
    ;[user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        stripeConnectAccountId: users.stripeConnectAccountId,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
  } catch (error) {
    if (isMissingStripeConnectColumn(error)) {
      redirect('/taster/profile?error=' + encodeURIComponent('Run db:migrate before using Stripe payouts.'))
    }

    throw error
  }

  if (!user) throw new Error('User not found')

  let stripeConnectAccountId = user.stripeConnectAccountId

  try {
    if (!stripeConnectAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          userId: user.id,
          role: 'taster',
        },
      })

      stripeConnectAccountId = account.id

      await db.update(users)
        .set({ stripeConnectAccountId })
        .where(eq(users.id, user.id))
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url: `${baseUrl}/taster/profile?stripe=refresh`,
      return_url: `${baseUrl}/taster/profile?stripe=return`,
      type: 'account_onboarding',
    })

    redirect(accountLink.url)
  } catch (error) {
    if (isMissingStripeConnectColumn(error)) {
      redirect('/taster/profile?error=' + encodeURIComponent('Run db:migrate before using Stripe payouts.'))
    }

    const message = error instanceof Stripe.errors.StripeError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Stripe payout setup failed.'

    redirect('/taster/profile?error=' + encodeURIComponent(message))
  }
}

export async function updateDriverProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    await db.update(users).set({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
      avatarUrl: (formData.get('avatarUrl') as string) || null,
    }).where(eq(users.id, userId))

    const driverId = formData.get('driverId') as string | null
    if (driverId) {
      const homeAddress = (formData.get('homeAddress') as string) || null
      const homeCity = (formData.get('homeCity') as string) || null
      const homeState = (formData.get('homeState') as string) || null
      const homeZip = (formData.get('homeZip') as string) || null
      const fullHomeAddress = [homeAddress, homeCity, homeState, homeZip].filter(Boolean).join(', ')
      let homeLat: string | null = null
      let homeLng: string | null = null

      if (fullHomeAddress) {
        try {
          const coords = await geocodeAddress(fullHomeAddress)
          homeLat = coords?.lat?.toFixed(7) ?? null
          homeLng = coords?.lng?.toFixed(7) ?? null
        } catch {}
      }

      await db.update(drivers).set({
        vehicleMake: (formData.get('vehicleMake') as string) || null,
        vehicleModel: (formData.get('vehicleModel') as string) || null,
        vehicleYear: (formData.get('vehicleYear') as string) || null,
        vin: (formData.get('vin') as string) || null,
        licensePlate: (formData.get('licensePlate') as string) || null,
        vehicleImageUrl: (formData.get('vehicleImageUrl') as string) || null,
        homeAddress,
        homeCity,
        homeState,
        homeZip,
        homeLat,
        homeLng,
        phone: (formData.get('phone') as string) || '',
      }).where(eq(drivers.id, driverId))
    }

    revalidatePath('/driver/profile')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getVehiclePhotoUploadUrl(
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; error?: string }> {
  try {
    await requireAuth()
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const filename = `vehicle-${uuidv4()}.${ext}`
    return await generateSignedUploadUrl(filename, contentType, 'vehicles')
  } catch (err) {
    return { uploadUrl: '', publicUrl: '', error: err instanceof Error ? err.message : String(err) }
  }
}
