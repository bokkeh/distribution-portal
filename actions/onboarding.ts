'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userPreferences } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

function isMissingPreferencesTable(error: unknown) {
  const dbError = error as { code?: string; message?: string; cause?: unknown } | null
  const code = dbError?.code ?? (dbError?.cause as { code?: string } | undefined)?.code
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return code === '42P01' || message.includes('user_preferences')
}

export async function completeRoleOnboarding(role: 'taster' | 'driver') {
  const session = await requireAuth()
  const roles = session.user.roles ?? [session.user.role]

  if (!roles.includes(role) && !roles.includes('admin')) {
    redirect('/unauthorized')
  }

  const now = new Date()

  try {
    await db.insert(userPreferences).values({
      userId: session.user.id,
      tasterOnboardingCompletedAt: role === 'taster' ? now : null,
      driverOnboardingCompletedAt: role === 'driver' ? now : null,
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        tasterOnboardingCompletedAt: role === 'taster' ? now : userPreferences.tasterOnboardingCompletedAt,
        driverOnboardingCompletedAt: role === 'driver' ? now : userPreferences.driverOnboardingCompletedAt,
        updatedAt: now,
      },
    })
  } catch (error) {
    if (!isMissingPreferencesTable(error)) throw error
  }

  redirect(role === 'taster' ? '/taster/tastings' : '/driver/deliveries')
}
