'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { dashboardOverheadTargets } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'

const monthKeyPattern = /^\d{4}-\d{2}$/

const setOverheadTargetSchema = z.object({
  monthKey: z.string().regex(monthKeyPattern, 'Invalid month'),
  amount: z.number().min(0).max(10_000_000),
})

export async function setOverheadTarget(input: { monthKey: string; amount: number }) {
  try {
    const session = await requireAdmin()
    const parsed = setOverheadTargetSchema.parse(input)

    await db
      .insert(dashboardOverheadTargets)
      .values({
        monthKey: parsed.monthKey,
        amount: parsed.amount.toFixed(2),
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: dashboardOverheadTargets.monthKey,
        set: {
          amount: parsed.amount.toFixed(2),
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        },
      })

    revalidatePath('/admin/dashboard')
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update overhead target.' }
  }
}
