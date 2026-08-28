import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { dashboardOverheadTargets } from '@/db/schema'

export const DEFAULT_MONTHLY_OVERHEAD = 1700

export async function getOverheadTargets(monthKeys: string[]): Promise<Record<string, number>> {
  const uniqueKeys = Array.from(new Set(monthKeys))
  const result: Record<string, number> = {}
  for (const key of uniqueKeys) result[key] = DEFAULT_MONTHLY_OVERHEAD
  if (!uniqueKeys.length) return result

  try {
    const rows = await db
      .select({ monthKey: dashboardOverheadTargets.monthKey, amount: dashboardOverheadTargets.amount })
      .from(dashboardOverheadTargets)
      .where(inArray(dashboardOverheadTargets.monthKey, uniqueKeys))

    for (const row of rows) result[row.monthKey] = Number(row.amount)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('dashboard_overhead_targets') || !message.includes('does not exist')) throw error
  }
  return result
}
