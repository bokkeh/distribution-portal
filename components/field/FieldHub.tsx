'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CalendarDays, Camera, Check, FileText, Package, Search, StickyNote, Wine } from 'lucide-react'
import { getFieldAccount, searchFieldAccounts, saveFieldNote, getFieldAvailability } from '@/actions/field-data'
import { getFieldDocument, sendFieldInvoice } from '@/actions/field-documents'
import { QuickScheduleTasting } from '@/components/tastings/QuickScheduleTasting'
import { AccountObservationForm } from '@/components/crm/AccountObservationForm'
import { Button } from '@/components/ui/button'
import { FieldDocumentForm, type FieldProduct, type SavedFieldDocument } from './FieldDocumentForm'
import { FieldCardPayment } from './FieldCardPayment'
import { FieldPhotos } from './FieldPhotos'
import { FieldAccountForm } from './FieldAccountForm'
import { fieldAvailabilityRows, type FieldAvailability } from '@/lib/field/availability'
import { formatEasternDate, getEasternDateKey } from '@/lib/tastings/time'
import { formatCurrency } from '@/lib/utils'

type Account = Awaited<ReturnType<typeof getFieldAccount>>
type Document = SavedFieldDocument & { status?: string; emailSentAt?: string | null }
type View = 'home' | 'tasting' | 'order' | 'invoice' | 'note' | 'photos' | 'observations' | 'document'

function FieldNote({ accountId }: { accountId: string }) {
  const locked = useRef(false), requestId = useRef<string | null>(null)
  const [text, setText] = useState(''), [pending, setPending] = useState(false), [message, setMessage] = useState('')
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    locked.current = true; setPending(true); setMessage('')
    try { requestId.current ??= crypto.randomUUID(); const result = await saveFieldNote(accountId, text, requestId.current); if (result.error) { setMessage(result.error); return }; requestId.current = null; setText(''); setMessage('Note saved to this account.') }
    catch { setMessage('Could not confirm save. Your note is kept; retry.') }
    finally { locked.current = false; setPending(false) }
  }}><h2 className="text-xl font-semibold">Quick client note</h2><label className="block">What happened?<textarea value={text} onChange={event => setText(event.target.value)} required maxLength={4000} disabled={pending} placeholder="Conversation, next step, shelf conditions…" className="mt-2 min-h-52 w-full rounded-2xl border bg-white p-4 text-base" /></label>{message ? <p role="status" className="rounded-xl bg-stone-100 p-3">{message}</p> : null}<Button className="h-14 w-full text-base" disabled={pending}>{pending ? 'Saving…' : 'Save note'}</Button></form>
}

function FieldTasting({ account, members, initialAvailability }: { account: Account; members: { id: string; name: string }[]; initialAvailability: FieldAvailability }) {
  const [availability, setAvailability] = useState(initialAvailability)
  const [choice, setChoice] = useState({ date: getEasternDateKey(new Date()), memberId: '' })
  const [showCount, setShowCount] = useState(8), [showBooked, setShowBooked] = useState(false), [error, setError] = useState('')
  const rows = fieldAvailabilityRows(availability)
  const visible = (showBooked ? rows : rows.filter(row => row.free)).slice(0, showCount)
  return <div className="space-y-5">
    <section className="space-y-3 rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Taster availability</h2><Button variant="outline" className="h-11" onClick={async () => { try { setAvailability(await getFieldAvailability()); setError('') } catch { setError('Could not refresh availability. Retry.') } }}>Refresh</Button></div>
      <p className="text-sm text-muted-foreground">Reported available dates for <strong>4–7 p.m. Eastern</strong>, with existing bookings checked. Final availability is checked again when saving.</p>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      <div className="space-y-2">{visible.map(row => <button type="button" key={`${row.userId}-${row.date}`} onClick={() => setChoice({ date: row.date, memberId: row.userId })} className={`min-h-20 w-full rounded-xl border p-3 text-left ${choice.date === row.date && choice.memberId === row.userId ? 'border-orange-500 bg-orange-50' : 'border-stone-200'}`}>
        <span className="block font-semibold">{formatEasternDate(`${row.date}T12:00:00Z`)} · {row.name}</span><span className={`mt-1 block text-sm ${row.free ? 'text-emerald-700' : 'text-amber-700'}`}>{row.free ? '4–7 p.m. free · Tap to book' : `Booked ${row.bookedLabel} · Choose another time below`}</span>
      </button>)}</div>
      {!visible.length ? <p className="rounded-xl bg-stone-50 p-3 text-sm">No reported open dates for this time window. Refresh, choose another time below, or schedule Unassigned.</p> : null}
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11" onClick={() => setShowCount(count => count + 12)}>More dates</Button><Button variant="ghost" className="h-11" onClick={() => setShowBooked(value => !value)}>{showBooked ? 'Show only open 4–7 dates' : 'Include booked dates'}</Button></div>
    </section>
    <div className="rounded-2xl border bg-white p-4"><QuickScheduleTasting key={`${choice.date}:${choice.memberId}`} accounts={[account]} members={members} initialAccountId={account.id} initialMemberId={choice.memberId || undefined} date={choice.date} hideAccountPicker onSaved={async () => { try { setAvailability(await getFieldAvailability()) } catch { setError('Tasting saved. Refresh availability before the next booking.') } }} /></div>
  </div>
}

export function FieldHub({ bootstrap, availability, initialAccount = null, initialDocument = null }: {
  bootstrap: { userName: string; canInvoice: boolean; canPhotos: boolean; products: FieldProduct[]; members: { id: string; name: string }[] }
  availability: FieldAvailability; initialAccount?: Account | null; initialDocument?: Document | null
}) {
  const [account, setAccount] = useState<Account | null>(initialAccount), [query, setQuery] = useState('')
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchFieldAccounts>>>([])
  const [searching, setSearching] = useState(!initialAccount), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [view, setView] = useState<View>(initialDocument ? 'document' : 'home'), [saved, setSaved] = useState<Document | null>(initialDocument)
  const [recipientEmail, setRecipientEmail] = useState(initialDocument?.email ?? '')
  const [deliveryMessage, setDeliveryMessage] = useState(''), [docPending, setDocPending] = useState(false)
  const documentLocked = useRef(false)
  const [addingAccount, setAddingAccount] = useState(false), [accountMessage, setAccountMessage] = useState('')
  useEffect(() => {
    if (!searching) return
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try { const rows = await searchFieldAccounts(query); if (active) { setResults(rows); setError('') } }
      catch { if (active) setError('Could not search accounts. Check your connection and try again.') }
      finally { if (active) setLoading(false) }
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [query, searching])
  const tasks = [
    { view: 'tasting' as const, title: 'Schedule tasting', detail: 'Open dates & team assignment', icon: CalendarDays },
    { view: 'order' as const, title: 'Create order', detail: 'Cases, payment & invoice', icon: Package },
    ...(bootstrap.canInvoice ? [{ view: 'invoice' as const, title: 'Quick invoice', detail: 'Create & send to customer', icon: FileText }] : []),
    { view: 'note' as const, title: 'Quick note', detail: 'Capture the conversation', icon: StickyNote },
    ...(bootstrap.canPhotos ? [{ view: 'photos' as const, title: 'Add photos', detail: 'Shelf, display or client visit', icon: Camera }] : []),
    { view: 'observations' as const, title: 'Price & inventory', detail: 'Record either or both', icon: Wine },
  ]
  const goHome = () => { setView('home'); window.history.replaceState(null, '', '/field') }
  return <div className="min-h-dvh bg-[#faf9f6] pb-[max(2rem,env(safe-area-inset-bottom))]">
    <header className="sticky top-0 z-20 bg-[#120f0e] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white"><div className="mx-auto flex max-w-2xl items-center gap-3"><Image src="/brand/logo-badge.png" alt="AHAWC" width={44} height={44} className="rounded-lg" /><div className="flex-1"><p className="font-display text-2xl font-bold uppercase">Field notes</p><p className="text-xs text-stone-300">{bootstrap.userName} · At your client</p></div><span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs text-orange-200">AHAWC / Wisher</span></div></header>
    <main className="mx-auto max-w-2xl space-y-5 p-4">
      <section className="rounded-2xl border bg-white p-4">
        {addingAccount ? <FieldAccountForm initialName={query} onCancel={() => setAddingAccount(false)} onSelected={(selected, created) => { setAccount(selected); setSearching(false); setAddingAccount(false); setView('home'); setSaved(null); setRecipientEmail(''); setDeliveryMessage(''); setError(''); setAccountMessage(created ? `${selected.companyName} saved. Ready for field tasks.` : ''); window.history.replaceState(null, '', '/field') }} /> : account && !searching ? <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working with</p><h1 className="mt-1 break-words text-xl font-bold">{account.companyName}</h1><p className="mt-1 text-sm text-muted-foreground">{[account.address, account.city, account.state].filter(Boolean).join(', ') || 'Address not entered'}</p></div><Button variant="outline" className="h-12" onClick={() => { setSearching(true); setQuery(''); setAccountMessage('') }}>Change</Button></div> : <>
          <label htmlFor="field-search" className="mb-2 block text-lg font-semibold">Find the account</label><div className="relative"><Search className="pointer-events-none absolute left-4 top-4 size-5 text-muted-foreground" /><input id="field-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Account, city or street…" autoComplete="off" className="h-14 w-full rounded-xl border bg-white pl-12 pr-4 text-base" /></div>
          <p className="mt-2 text-xs text-muted-foreground">{loading ? 'Searching…' : 'Tap an account. Search narrows the list.'}</p>
          <Button variant="outline" className="mt-3 h-14 w-full text-base" onClick={() => setAddingAccount(true)}>Add new account</Button>
          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto overscroll-contain">{results.map(row => <button type="button" key={row.id} disabled={loading} className="min-h-16 w-full rounded-xl p-3 text-left hover:bg-orange-50" onClick={async () => {
            setLoading(true); setError('')
            try { const selected = await getFieldAccount(row.id); setAccount(selected); setSaved(null); setRecipientEmail(''); setDeliveryMessage(''); setAccountMessage(''); setSearching(false); setView('home'); window.history.replaceState(null, '', '/field') }
            catch { setError('Could not load this account. Retry.') }
            finally { setLoading(false) }
          }}><span className="block font-semibold">{row.companyName}</span><span className="block text-sm text-muted-foreground">{[row.city, row.state, row.address].filter(Boolean).join(' · ')}</span></button>)}</div>
          {!loading && query && !results.length ? <p className="mt-3 text-sm">No matching account. Try its city or street.</p> : null}
          {account ? <Button variant="ghost" className="mt-2 h-12 w-full" onClick={() => setSearching(false)}>Keep {account.companyName}</Button> : null}
        </>}
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>
      {accountMessage && !searching ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{accountMessage}</p> : null}
      {!addingAccount && !searching && account ? <>
        {view !== 'home' ? <Button variant="outline" className="h-12 w-full justify-start" onClick={goHome}><ArrowLeft className="size-5" />Back to field tasks</Button> : null}
        {view === 'home' ? <><div><h2 className="text-lg font-semibold">What do you need to do?</h2><p className="mt-1 text-sm text-muted-foreground">One account. Simple actions while you’re there.</p></div><div className="grid grid-cols-2 gap-3">{tasks.map(task => <button key={task.view} type="button" onClick={() => setView(task.view)} className="flex min-h-36 flex-col items-start justify-between gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm active:bg-orange-50"><task.icon className="size-7 text-[#ff5a00]" /><div><span className="block text-lg font-bold leading-tight">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.detail}</span></div></button>)}</div>{saved ? <Button variant="outline" className="h-14 w-full" onClick={() => setView('document')}>Return to invoice {saved.invoiceNumber}</Button> : null}</> : null}
        {view === 'note' ? <FieldNote key={account.id} accountId={account.id} /> : null}
        {view === 'photos' ? <FieldPhotos key={account.id} accountId={account.id} /> : null}
        {view === 'observations' ? <AccountObservationForm key={account.id} accountId={account.id} products={bootstrap.products} fieldMode /> : null}
        {view === 'tasting' ? <FieldTasting key={account.id} account={account} members={bootstrap.members} initialAvailability={availability} /> : null}
        {view === 'order' || view === 'invoice' ? <FieldDocumentForm key={`${account.id}:${view}`} account={account} products={bootstrap.products} kind={view} onSaved={(document, message) => { setSaved(document); setRecipientEmail(document.email); setDeliveryMessage(message); setView('document'); window.history.replaceState(null, '', `/field?invoice=${document.requestId}`) }} /> : null}
        {view === 'document' && saved ? <div className="space-y-4">
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><Check className="mb-2 size-7 text-emerald-700" /><h2 className="text-xl font-bold">{saved.orderId ? 'Order & invoice saved' : 'Invoice saved'}</h2><p className="mt-2 break-all">{saved.invoiceNumber} · {formatCurrency(saved.total)}</p><p className="mt-2 text-sm">{saved.status === 'paid' ? 'Payment received.' : `${saved.paymentMethod === 'cod' ? 'COD' : saved.paymentMethod === 'check' ? 'Check' : 'Stripe card'} · Payment not yet confirmed.`}</p></div>
          {deliveryMessage ? <p role="status" className="rounded-xl bg-white p-3 text-sm">{deliveryMessage}</p> : saved.emailSentAt ? <p className="text-sm">Emailed to {saved.email}</p> : null}
          <label className="block">Invoice recipient email<input type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} className="mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base" /></label>
          <Button className="h-14 w-full text-base" disabled={docPending} onClick={async () => { if (documentLocked.current) return; documentLocked.current = true; setDocPending(true); try { const result = await sendFieldInvoice(saved.requestId, recipientEmail); setDeliveryMessage(result.error ?? result.message ?? 'Check email status.'); setSaved({ ...saved, ...(await getFieldDocument(saved.requestId)) }) } catch { setDeliveryMessage('Could not confirm email. Invoice remains saved.'); } finally { documentLocked.current = false; setDocPending(false) } }}>{docPending ? 'Sending…' : 'Email invoice to customer'}</Button>
          <a href={saved.paymentPath} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-center rounded-xl border bg-white px-4 text-base font-semibold">View customer invoice & PDF</a>
          <Button variant="outline" className="h-14 w-full text-base" onClick={async () => { try { const url = `${window.location.origin}${saved.paymentPath}`; if (navigator.share) await navigator.share({ title: `Invoice ${saved.invoiceNumber}`, url }); else { await navigator.clipboard.writeText(url); setDeliveryMessage('Secure invoice link copied.'); } } catch { setDeliveryMessage('Could not share. Open the invoice and copy its URL.'); } }}>Share secure invoice link</Button>
          <Button variant="outline" className="h-12 w-full" disabled={docPending} onClick={async () => { setDocPending(true); try { setSaved({ ...saved, ...(await getFieldDocument(saved.requestId)) }); setDeliveryMessage('Invoice status refreshed.') } catch { setDeliveryMessage('Could not refresh invoice status. Retry.') } finally { setDocPending(false) } }}>Refresh payment status</Button>
          {saved.paymentMethod === 'stripe' && saved.status !== 'paid' ? <FieldCardPayment key={saved.requestId} requestId={saved.requestId} /> : null}
        </div> : null}
        <Link href="/field" onClick={event => { event.preventDefault(); setSearching(true); setView('home'); setAccount(null); setSaved(null); window.history.replaceState(null, '', '/field') }} className="flex min-h-12 items-center justify-center text-sm text-muted-foreground underline">Next client · choose another account</Link>
      </> : <p className="px-2 text-sm text-muted-foreground">Choose a client to schedule, order, invoice, or capture field notes.</p>}
    </main>
  </div>
}
