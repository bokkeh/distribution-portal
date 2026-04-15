'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { industryNewsSources, userPreferences } from '@/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { syncIndustryNews } from '@/lib/industry-news'

function isMissingNewsPreferenceColumns(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('news_notifications_muted')
    || message.includes('news_digest_frequency')
    || message.includes('news_email_enabled')
    || message.includes('news_sms_enabled')
    || message.includes('news_in_app_enabled')
}

export async function updateIndustryNewsPreferences(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    await db.insert(userPreferences).values({
      userId,
      newsNotificationsMuted: formData.get('newsNotificationsMuted') === 'on',
      newsDigestFrequency: (formData.get('newsDigestFrequency') as string) || 'important_only',
      newsEmailEnabled: formData.get('newsEmailEnabled') === 'on',
      newsSmsEnabled: formData.get('newsSmsEnabled') === 'on',
      newsInAppEnabled: formData.get('newsInAppEnabled') === 'on',
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        newsNotificationsMuted: formData.get('newsNotificationsMuted') === 'on',
        newsDigestFrequency: (formData.get('newsDigestFrequency') as string) || 'important_only',
        newsEmailEnabled: formData.get('newsEmailEnabled') === 'on',
        newsSmsEnabled: formData.get('newsSmsEnabled') === 'on',
        newsInAppEnabled: formData.get('newsInAppEnabled') === 'on',
        updatedAt: new Date(),
      },
    })

    revalidatePath('/admin/news')
    revalidatePath('/staff/news')
    revalidatePath('/sales/news')
    revalidatePath('/taster/news')
    revalidatePath('/driver/news')
    revalidatePath('/customer/news')
    return { success: true }
  } catch (error) {
    if (isMissingNewsPreferenceColumns(error)) {
      return { error: 'Run npm run db:push before saving news notification settings.' }
    }
    return { error: error instanceof Error ? error.message : 'Failed to save news settings.' }
  }
}

export async function toggleIndustryNewsSource(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireRole('admin')
    const sourceId = formData.get('sourceId') as string
    const active = formData.get('active') === 'true'
    if (!sourceId) throw new Error('Source is required')

    await db
      .update(industryNewsSources)
      .set({ active, updatedAt: new Date() })
      .where(eq(industryNewsSources.id, sourceId))

    revalidatePath('/admin/news')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update source.' }
  }
}

export async function syncIndustryNewsNow() {
  await requireRole('admin')
  await syncIndustryNews(true)
  revalidatePath('/admin/news')
  revalidatePath('/admin/dashboard')
  revalidatePath('/staff/news')
  revalidatePath('/sales/news')
  revalidatePath('/taster/news')
  revalidatePath('/driver/news')
  revalidatePath('/customer/news')
}
