'use client'

import { Button } from '@/components/ui/button'

export function DeleteDraftInvoiceButton({
  action,
}: {
  action: () => Promise<void>
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm('Delete this draft invoice? This cannot be undone.')) {
          event.preventDefault()
        }
      }}
    >
      <Button variant="destructive" className="w-full" type="submit">
        Delete Draft Invoice
      </Button>
    </form>
  )
}
