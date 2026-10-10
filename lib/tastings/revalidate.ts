import { revalidatePath } from 'next/cache'

export function refreshTastingViews(accountId?: string, tastingId?: string) {
  for (const path of ['/admin/tastings', '/staff/tastings', '/sales/tastings', '/sales/tastings/schedule', '/taster/tastings', '/taster/payouts', '/admin/dashboard', '/staff/dashboard', '/sales/dashboard', '/taster/dashboard', '/admin/crm', '/staff/crm', '/sales/accounts', '/admin/pull-through/tastings']) revalidatePath(path)
  if (accountId) for (const path of [`/admin/crm/${accountId}`, `/staff/crm/${accountId}`, `/sales/accounts/${accountId}`]) revalidatePath(path)
  if (tastingId) for (const path of [`/admin/tastings/${tastingId}`, `/taster/tastings/${tastingId}`]) revalidatePath(path)
}
