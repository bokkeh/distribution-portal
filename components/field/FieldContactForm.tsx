'use client'

import { useRef, useState } from 'react'
import { createFieldContact, type getFieldAccount } from '@/actions/field-data'
import { Button } from '@/components/ui/button'

export function FieldContactForm({ accountId, onCancel, onSaved }: { accountId: string; onCancel: () => void; onSaved: (account: Awaited<ReturnType<typeof getFieldAccount>>, name: string) => void }) {
  const locked = useRef(false), requestId = useRef<string | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const inputClass = 'mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base'
  return <form className="space-y-4 rounded-2xl border bg-white p-4" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    const data = new FormData(event.currentTarget)
    locked.current = true; setPending(true); setError(''); requestId.current ??= crypto.randomUUID()
    try {
      const result = await createFieldContact({ requestId: requestId.current, accountId, name: String(data.get('name') ?? ''), email: String(data.get('email') ?? '').trim(), phone: String(data.get('phone') ?? ''), title: String(data.get('title') ?? ''), preferredContact: String(data.get('preferredContact') ?? '') as '' | 'email' | 'sms' | 'call', isPrimary: data.get('isPrimary') === 'on' })
      if (result.error || !result.account) { setError(result.error ?? 'Could not confirm save. Your details are kept; retry.'); return }
      onSaved(result.account, String(data.get('name') ?? '').trim())
    } catch { setError('Could not confirm contact save. Your details are kept; retry the same entry.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <h3 className="text-lg font-semibold">Add a contact</h3>
    <p className="text-sm text-muted-foreground">Saved to this account. Only a name is required.</p>
    <fieldset disabled={pending} className="space-y-4">
      <label className="block">Contact name<input name="name" required maxLength={160} autoComplete="name" className={inputClass} /></label>
      <label className="block">Contact phone (optional)<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} /></label>
      <label className="block">Contact email (optional)<input name="email" type="email" maxLength={254} autoComplete="email" className={inputClass} /></label>
      <details className="rounded-xl border p-3"><summary className="cursor-pointer py-2 font-semibold">Role & preferences (optional)</summary><div className="mt-3 space-y-4">
        <label className="block">Job title / role<input name="title" maxLength={160} autoComplete="organization-title" className={inputClass} /></label>
        <label className="block">Preferred contact method<select name="preferredContact" className={inputClass}><option value="">Not specified</option><option value="call">Call</option><option value="email">Email</option><option value="sms">Text</option></select></label>
        <label className="flex min-h-12 items-center gap-3"><input name="isPrimary" type="checkbox" className="size-5" />Mark as a primary contact</label>
      </div></details>
    </fieldset>
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{error}</p> : null}
    <Button className="h-14 w-full text-base" disabled={pending}>{pending ? 'Saving contact…' : 'Save contact'}</Button>
    <Button variant="outline" type="button" className="h-12 w-full" disabled={pending} onClick={onCancel}>Cancel adding contact</Button>
  </form>
}
