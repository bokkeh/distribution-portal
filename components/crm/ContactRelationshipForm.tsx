'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateContactRelationship } from '@/actions/contact-records'
import { createTask } from '@/actions/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseDateTimeInTimeZone } from '@/lib/tastings/time'

export function ContactRelationshipForm({ contact, accounts, userId }: {
  contact: { id: string; name: string; customerId: string | null; relationshipStatus: string | null }
  accounts: { id: string; companyName: string }[]; userId: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const cls = 'h-11 w-full rounded-md border border-input bg-white px-3 text-base'
  return <div className="space-y-6">
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget)
      setPending(true); setMessage('')
      try { const result = await updateContactRelationship(contact.id, data); setMessage(result.error ?? 'Contact saved.'); if (!result.error) router.refresh() }
      catch { setMessage('Could not confirm update. Retry.') } finally { setPending(false) }
    }}>
      <label className="block space-y-1">Company (optional)<select name="customerId" className={cls} defaultValue={contact.customerId ?? ''}><option value="">No company</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.companyName}</option>)}</select></label>
      <label className="block space-y-1">Or new company name<Input name="newCompanyName" placeholder="Link a new company later" /></label>
      <label className="block space-y-1">Relationship status<select name="relationshipStatus" className={cls} defaultValue={contact.relationshipStatus ?? ''}><option value="">Unspecified</option><option value="active">Active</option><option value="keep_in_touch">Keep in touch</option><option value="inactive">Inactive</option></select></label>
      <p className="text-sm text-muted-foreground">Relationship status is separate from the account sales pipeline.</p>
      <Button disabled={pending}>Save contact relationship</Button>
    </form>
    <form className="space-y-3 rounded-xl border p-4" onSubmit={async event => {
      event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget)
      setPending(true); setMessage('')
      try {
        const due = parseDateTimeInTimeZone(String(data.get('date')), '09:00')
        if (!Number.isFinite(due.getTime())) { setMessage('Choose a valid follow-up date.'); return }
        const result = await createTask({ title: `Keep in touch with ${contact.name}`, contactId: contact.id, accountId: contact.customerId, assignedToUserId: userId, dueAt: due.toISOString(), notificationChannels: ['in-app'], priority: 'normal' })
        setMessage('error' in result ? result.error ?? 'Could not create follow-up.' : 'Follow-up created. See Tasks.'); router.refresh()
      } catch { setMessage('Could not create follow-up. Retry.') } finally { setPending(false) }
    }}>
      <h2 className="font-semibold">Keep in touch follow-up</h2>
      <label className="block">Follow-up date (Eastern)<Input name="date" type="date" required /></label>
      <Button variant="outline" disabled={pending}>Create follow-up task</Button>
    </form>
    {message ? <p role="status">{message}</p> : null}
  </div>
}
