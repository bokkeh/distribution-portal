'use client'

import { useRef, useState } from 'react'
import { getFieldAccount } from '@/actions/field-data'
import { Button } from '@/components/ui/button'
import { FieldContactForm } from './FieldContactForm'

type Account = Awaited<ReturnType<typeof getFieldAccount>>

function ContactDetails({ name, title, phone, email, preferred }: { name: string; title?: string | null; phone?: string | null; email?: string | null; preferred?: string | null }) {
  const dialNumber = phone?.replace(/[^\d+*#,;]/g, '')
  return <div className="space-y-2 rounded-xl border bg-white p-4">
    <h3 className="break-words text-lg font-semibold">{name}</h3>
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
  const [adding, setAdding] = useState(false), [success, setSuccess] = useState('')
  const poc = account.pointOfContact, business = account.businessContact
  const hasPoc = !!(poc.name || poc.phone || poc.email)
  const pocAlreadyListed = hasPoc && account.contacts.some(contact => contact.name.trim().toLowerCase() === poc.name?.trim().toLowerCase() && (contact.phone ?? '') === (poc.phone ?? '') && (contact.email ?? '').toLowerCase() === (poc.email ?? '').toLowerCase())
  return <section aria-label="Account contact information" className="space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Contact information</h2><Button variant="outline" type="button" className="h-12" disabled={pending || adding} onClick={async () => {
      if (locked.current) return
      locked.current = true; setPending(true); setError('')
      try { const updated = await getFieldAccount(account.id); setAccount(updated); onAccountChanged?.(updated) }
      catch { setError('Could not refresh contacts. Check your connection and retry. Details below are from the last successful load.') }
      finally { locked.current = false; setPending(false) }
    }}>{pending ? 'Refreshing…' : 'Refresh contacts'}</Button></div>
    {adding ? <FieldContactForm accountId={account.id} onCancel={() => setAdding(false)} onSaved={(updated, name) => { setAccount(updated); onAccountChanged?.(updated); setAdding(false); setError(''); setSuccess(`${name} saved to this account.`) }} /> : <Button type="button" className="h-14 w-full text-base" disabled={pending} onClick={() => { setAdding(true); setSuccess('') }}>Add contact</Button>}
    {success ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{success}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{error}</p> : null}
    {hasPoc && !pocAlreadyListed ? <ContactDetails name={poc.name || 'Account point of contact'} title="Account point of contact" phone={poc.phone} email={poc.email} /> : null}
    {account.contacts.map(contact => <ContactDetails key={contact.id} name={contact.name} title={[contact.isPrimary ? 'Primary contact' : null, contact.title].filter(Boolean).join(' · ')} phone={contact.phone} email={contact.email} preferred={contact.preferredContact} />)}
    {business.phone || business.email ? <ContactDetails name="Business contact" title={account.companyName} phone={business.phone} email={business.email} /> : null}
    {!hasPoc && !account.contacts.length && !business.phone && !business.email ? <p className="rounded-xl border bg-white p-4 text-muted-foreground">No contact information recorded for this account yet.</p> : null}
  </section>
}
