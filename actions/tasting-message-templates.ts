'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tastingSmsTemplates } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { upsertDefaultTastingSmsTemplates, TASTING_SMS_SEQUENCE } from '@/lib/tastings/sms-series'

export async function saveTastingSmsTemplates(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdmin()
    await upsertDefaultTastingSmsTemplates()

    for (const template of TASTING_SMS_SEQUENCE) {
      const bodyTemplate = (formData.get(`${template.key}:bodyTemplate`) as string) || template.bodyTemplate
      const linkPath = (formData.get(`${template.key}:linkPath`) as string) || template.linkPath

      await db.update(tastingSmsTemplates).set({
        bodyTemplate,
        linkPath,
        updatedAt: new Date(),
      }).where(eq(tastingSmsTemplates.key, template.key))
    }

    revalidatePath('/admin/tastings/messages')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to save tasting SMS templates.' }
  }
}
