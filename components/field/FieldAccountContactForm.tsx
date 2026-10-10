'use client'

import { useEffect, useRef, useState } from 'react'
import { updateFieldAccountContact, type getFieldAccount } from '@/actions/field-data'
import { Button } from '@/components/ui/button'
type Account = Awaited<ReturnType<typeof getFieldAccount>>
export function FieldAccountContactForm({ account, kind, onCancel, onSaved }: { account: Account; kind: 'poc' | 'business'; onCancel: () => void; onSaved: (account: Account, name: string) => void }) {
  const locked = useRef(false)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  const current = kind === 'poc' ? account.pointOfContact : { ...account.businessContact, name: '' }
  const inputClass = 'mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base'
  return <form className="space-y-4 rounded-2xl border bg-white p-4" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    const data = new FormData(event.currentTarget)
    locked.current = true; setPending(true); setError('')
    try {
      const result = await updateFieldAccountContact({ accountId: account.id, kind, name: String(data.get('name') ?? ''), phone: String(data.get('phone') ?? ''), email: String(data.get('email') ?? '').trim(), expected: { name: current.name ?? '', phone: current.phone ?? '', email: current.email ?? '' } })
      if (result.error || !result.account) { setError(result.error ?? 'Could not confirm update. Retry.'); return }
      onSaved(result.account, kind === 'poc' ? 'Account point of contact' : 'Business contact')
    } catch { setError('Could not confirm update. Your details are kept; retry.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <h3 ref={heading} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold focus:outline-none">Edit {kind === 'poc' ? 'account point of contact' : 'business contact'}</h3>
    <p className="text-sm text-muted-foreground">Updates the account details in the main CRM. Job titles and preferences belong to the individual contact cards.</p>
    <fieldset disabled={pending} className="space-y-4">
      {kind === 'poc' ? <label className="block">Contact name<input name="name" maxLength={160} defaultValue={current.name ?? ''} className={inputClass} autoComplete="name" /></label> : null}
      <label className="block">Contact phone (optional)<input name="phone" type="tel" maxLength={40} defaultValue={current.phone ?? ''} className={inputClass} autoComplete="tel" /></label>
      <label className="block">Contact email (optional)<input name="email" type="email" maxLength={254} defaultValue={current.email ?? ''} className={inputClass} autoComplete="email" /></label>
    </fieldset>
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3">{error}</p> : null}
    <Button className="h-14 w-full" disabled={pending}>{pending ? 'Saving contact…' : 'Save contact'}</Button>
    <Button type="button" variant="outline" className="h-12 w-full" disabled={pending} onClick={onCancel}>Cancel editing contact</Button>
  </form>
}
