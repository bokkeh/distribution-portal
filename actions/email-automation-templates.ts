'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { emailAutomationTemplates } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { EMAIL_AUTOMATION_DEFAULTS, upsertDefaultEmailAutomationTemplates } from '@/lib/resend/email-templates'

export async function saveEmailAutomationTemplates(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdmin()
    await upsertDefaultEmailAutomationTemplates()

    for (const template of EMAIL_AUTOMATION_DEFAULTS) {
      await db.update(emailAutomationTemplates).set({
        subjectTemplate: ((formData.get(`${template.key}:subjectTemplate`) as string) || template.subjectTemplate).trim(),
        eyebrow: ((formData.get(`${template.key}:eyebrow`) as string) || template.eyebrow).trim(),
        titleTemplate: ((formData.get(`${template.key}:titleTemplate`) as string) || template.titleTemplate).trim(),
        introTemplate: ((formData.get(`${template.key}:introTemplate`) as string) || '').trim() || null,
        bodyTemplate: ((formData.get(`${template.key}:bodyTemplate`) as string) || template.bodyTemplate).trim(),
        ctaLabel: ((formData.get(`${template.key}:ctaLabel`) as string) || '').trim() || null,
        ctaPath: ((formData.get(`${template.key}:ctaPath`) as string) || '').trim() || null,
        updatedAt: new Date(),
      }).where(eq(emailAutomationTemplates.key, template.key))
    }

    revalidatePath('/admin/automations')
    revalidatePath('/admin/automations/emails')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to save email templates.' }
  }
}
