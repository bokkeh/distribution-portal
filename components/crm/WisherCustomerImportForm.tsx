'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { importWisherCustomersCsv } from '@/actions/crm'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function WisherCustomerImportForm() {
  const [state, action, pending] = useActionState(importWisherCustomersCsv, null)

  useEffect(() => {
    if (!state) return
    if (state.error) {
      toast.error('Import failed', { description: state.error })
      return
    }
    if (state.success) {
      toast.success('Wisher customers imported')
    }
  }, [state])

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wisher-csv">Wisher customer CSV</Label>
        <input
          id="wisher-csv"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
        />
        <p className="text-xs text-slate-500">
          Expected format: Shopify customer export with columns like Customer ID, First Name, Last Name, Email, and Default Address fields.
        </p>
      </div>

      {state?.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Imported {state.importedCount ?? 0} new customers, updated {state.updatedCount ?? 0}, skipped {state.skippedCount ?? 0}, invalid rows {state.invalidRowCount ?? 0}.
        </div>
      ) : null}

      {state?.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? 'Importing...' : 'Import Customers'}</Button>
        <Link href="/admin/crm" className={buttonVariants({ variant: 'outline' })}>Back to CRM</Link>
      </div>
    </form>
  )
}
