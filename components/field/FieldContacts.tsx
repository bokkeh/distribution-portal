'use client'

import { useEffect, useRef, useState } from 'react'
import { getFieldAccount } from '@/actions/field-data'
import { Button } from '@/components/ui/button'
import { FieldContactForm } from './FieldContactForm'
import { FieldAccountContactForm } from './FieldAccountContactForm'

type Account = Awaited<ReturnType<typeof getFieldAccount>>

function ContactDetails({ name, title, phone, email, preferred, onEdit, editLabel, disabled }: { name: string; title?: string | null; phone?: string | null; email?: string | null; preferred?: string | null; onEdit: () => void; editLabel?: string; disabled: boolean }) {
  const dialNumber = phone?.replace(/[^\d+*#,;]/g, '')
  return <div className="space-y-2 rounded-xl border bg-white p-4">
    <button type="button" aria-label={editLabel ?? `Edit ${name}`} disabled={disabled} onClick={onEdit} className="min-h-14 w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-orange-500"><h3 className="break-words text-lg font-semibold">{name}</h3><span className="text-sm text-orange-700 underline">Tap to edit contact</span></button>
    {title ? <p className="break-words text-sm text-muted-foreground">{title}</p> : null}
    {preferred ? <p className="text-sm">{preferred === 'sms' ? 'Text' : preferred === 'call' ? 'Call' : 'Email'} preferred</p> : null}
    <div className="space-y-2">
      {dialNumber ? <a href={`tel:${dialNumber}`} aria-label={`Call ${name}: ${phone}`} className="flex min-h-14 items-center rounded-xl border bg-orange-50 p-3 font-semibold">Call · {phone}</a> : null}
      {email ? <a href={`mailto:${encodeURIComponent(email.trim())}`} aria-label={`Email ${name}: ${email}`} className="flex min-h-14 items-center break-all rounded-xl border bg-orange-50 p-3 font-semibold">Email · {email}</a> : null}
    </div>
    {!dialNumber && !email ? <p className="text-sm text-muted-foreground">No phone or email recorded.</p> : null}
  </div>
}

export function FieldContacts({ account: initialAccount, onAccountChanged }: { account: Account; onAccountChanged?: (account: Account) => void }) {
  const [account, setAccount] = useState(initialAccount), [pending, setPending] = useState(false), [error, setError] = useState('')
  const locked = useRef(false)
  const [editing, setEditing] = useState<Account['contacts'][number] | 'poc' | 'business' | null>(null)
  const [adding, setAdding] = useState(false), [success, setSuccess] = useState('')
  const confirmation = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!success) return
    confirmation.current?.focus({ preventScroll: true })
    confirmation.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [success])
  const poc = account.pointOfContact, business = account.businessContact
  const hasPoc = !!(poc.name || poc.phone || poc.email)
  const pocAlreadyListed = hasPoc && account.contacts.some(contact => contact.name.trim().toLowerCase() === poc.name?.trim().toLowerCase() && (contact.phone ?? '') === (poc.phone ?? '') && (contact.email ?? '').toLowerCase() === (poc.email ?? '').toLowerCase())
  const saved = (updated: Account, name: string) => { setAccount(updated); onAccountChanged?.(updated); setAdding(false); setEditing(null); setError(''); setSuccess(`${name} saved to this account.`) }
  const busy = pending || adding || !!editing
  return <section aria-label="Account contact information" className="space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Contact information</h2><Button variant="outline" type="button" className="h-12" disabled={pending || adding || !!editing} onClick={async () => {
      if (locked.current) return
      locked.current = true; setPending(true); setError('')
      try { const updated = await getFieldAccount(account.id); setAccount(updated); onAccountChanged?.(updated) }
      catch { setError('Could not refresh contacts. Check your connection and retry. Details below are from the last successful load.') }
      finally { locked.current = false; setPending(false) }
    }}>{pending ? 'Refreshing…' : 'Refresh contacts'}</Button></div>
    {editing ? typeof editing === 'string' ? <FieldAccountContactForm key={editing} account={account} kind={editing} onCancel={() => setEditing(null)} onSaved={saved} /> : <FieldContactForm key={editing.id} accountId={account.id} contact={editing} onCancel={() => setEditing(null)} onSaved={saved} /> : adding ? <FieldContactForm accountId={account.id} onCancel={() => setAdding(false)} onSaved={saved} /> : <Button type="button" className="h-14 w-full text-base" disabled={pending} onClick={() => { setAdding(true); setSuccess('') }}>Add contact</Button>}
    {success ? <p ref={confirmation} tabIndex={-1} role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{success}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{error}</p> : null}
    {hasPoc && !pocAlreadyListed ? <ContactDetails name={poc.name || 'Account point of contact'} editLabel="Edit account point of contact" disabled={busy} onEdit={() => { setEditing('poc'); setSuccess('') }} title="Account point of contact" phone={poc.phone} email={poc.email} /> : null}
    {pocAlreadyListed ? <Button type="button" variant="outline" className="min-h-12 w-full" disabled={busy} onClick={() => { setEditing('poc'); setSuccess('') }}>Edit account point of contact</Button> : null}
    {account.contacts.map(contact => <ContactDetails key={contact.id} disabled={busy} onEdit={() => { setEditing(contact); setSuccess('') }} name={contact.name} title={[contact.isPrimary ? 'Primary contact' : null, contact.title].filter(Boolean).join(' · ')} phone={contact.phone} email={contact.email} preferred={contact.preferredContact} />)}
    {business.phone || business.email ? <ContactDetails disabled={busy} onEdit={() => { setEditing('business'); setSuccess('') }} name="Business contact" title={account.companyName} phone={business.phone} email={business.email} /> : null}
    {!hasPoc && !account.contacts.length && !business.phone && !business.email ? <p className="rounded-xl border bg-white p-4 text-muted-foreground">No contact information recorded for this account yet.</p> : null}
  </section>
}
