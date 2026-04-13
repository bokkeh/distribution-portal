'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { publishPromotionCatalogItem } from '@/actions/promotion-catalog'
import { Button } from '@/components/ui/button'

export function PromotionCatalogPublishForm({
  itemId,
  accounts,
}: {
  itemId: string
  accounts: Array<{ id: string; companyName: string; city: string | null; state: string | null }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await publishPromotionCatalogItem(formData)
      if (result?.error) {
        toast.error('Not published', { description: result.error })
        return
      }
      toast.success('Catalog item sent to account')
      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <input type="hidden" name="itemId" value={itemId} />
      <select
        name="accountId"
        required
        defaultValue=""
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="" disabled>Send to account...</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.companyName} {account.city || account.state ? `• ${[account.city, account.state].filter(Boolean).join(', ')}` : ''}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" name="repRecommended" className="rounded" />
        Mark as rep-recommended
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full">
        {pending ? 'Publishing...' : 'Publish to Account'}
      </Button>
    </form>
  )
}
