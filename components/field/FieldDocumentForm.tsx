'use client'

import { useRef, useState } from 'react'
import { quoteFieldDocument, saveFieldDocument, sendFieldInvoice } from '@/actions/field-documents'
import type { FieldDocumentInput } from '@/lib/field/validation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

export type FieldProduct = { id: string; name: string; sku: string; price: string; bottlesPerCase: number }
export type SavedFieldDocument = { requestId: string; invoiceId: string; invoiceNumber: string; total: string; orderId: string | null; paymentMethod: 'check' | 'cod' | 'stripe'; email: string; paymentPath: string }

export function FieldDocumentForm({ account, products, kind, onSaved }: {
  account: { id: string; companyName: string; email: string }; products: FieldProduct[]; kind: 'order' | 'invoice'; onSaved: (document: SavedFieldDocument, deliveryMessage: string) => void
}) {
  const locked = useRef(false), requestId = useRef<string | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const [review, setReview] = useState<{ input: FieldDocumentInput; total: string; amount: string; lines: { name: string; quantity: string; unitPrice: string; total: string }[] } | null>(null)
  const [method, setMethod] = useState<'check' | 'cod' | 'stripe'>('check')
  const cls = 'mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base'
  const reviewPanel = review ? <div className="space-y-4">
    <h2 className="text-xl font-semibold">Review {kind === 'order' ? 'order & invoice' : 'invoice'}</h2>
    <p>{account.companyName} · {review.input.paymentMethod === 'stripe' ? 'Stripe card' : review.input.paymentMethod === 'cod' ? 'Cash on delivery' : 'Check'}</p>
    <div className="divide-y rounded-2xl border bg-white p-4">{review.lines.map((line, index) => <div key={index} className="py-3"><p className="font-semibold">{line.name}</p><p className="text-sm text-muted-foreground">{line.quantity} {kind === 'order' ? 'cases' : 'item'} × {formatCurrency(line.unitPrice)} <strong className="float-right text-foreground">{formatCurrency(line.total)}</strong></p></div>)}</div>
    <div className="rounded-2xl bg-[#120f0e] p-5 text-white"><span>Total before card processing fee</span><p className="mt-1 text-3xl font-bold">{formatCurrency(review.total)}</p></div>
    <p className="text-sm">{review.input.email ? <>Invoice will be emailed to <strong>{review.input.email}</strong>.</> : 'Invoice will be saved for sharing. You can add an email after saving.'} {kind === 'invoice' ? 'This invoice does not reserve inventory or create an order.' : 'Standard delivery. Cases are reserved when the order saves.'}</p>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}
    <Button className="h-14 w-full text-base" disabled={pending} onClick={async () => {
      if (locked.current) return
      locked.current = true; setPending(true); setError('')
      try {
        const result = await saveFieldDocument({ ...review.input, quotedTotal: review.total })
        if ('error' in result) { setError(result.error); return }
        if (!result.success) throw new Error('Save not confirmed.')
        let deliveryMessage = 'Invoice saved. Email has not been confirmed.'
        try { const sent = await sendFieldInvoice(result.requestId); deliveryMessage = sent.error ?? sent.message ?? deliveryMessage } catch { deliveryMessage = 'Invoice saved; email could not be confirmed. Retry email from the saved invoice.' }
        onSaved(result, deliveryMessage)
      } catch { setError('Could not confirm save. Your entry is kept. Retry uses the same request to avoid duplicates.') }
      finally { locked.current = false; setPending(false) }
    }}>{pending ? 'Saving and sending…' : kind === 'order' ? (review.input.email ? 'Create order & email invoice' : 'Create order & invoice') : (review.input.email ? 'Create & email invoice' : 'Create invoice')}</Button>
    <Button variant="outline" className="h-12 w-full" disabled={pending} onClick={() => { setReview(null); setError('') }}>Edit entry</Button>
  </div> : null
  return <>{reviewPanel}<form hidden={!!review} className="space-y-5" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    const data = new FormData(event.currentTarget)
    requestId.current ??= crypto.randomUUID()
    const input: FieldDocumentInput = { requestId: requestId.current, accountId: account.id, kind, paymentMethod: method, email: String(data.get('email') ?? ''), notes: String(data.get('notes') ?? ''), tax: String(data.get('tax') ?? '0') || '0',
      items: products.map(product => ({ productId: product.id, quantity: Number(data.get(`quantity-${product.id}`) ?? 0) })).filter(item => item.quantity > 0),
      description: String(data.get('description') ?? ''), ...(kind === 'invoice' ? { amount: String(data.get('amount') ?? '') } : {}),
    }
    locked.current = true; setPending(true); setError('')
    try { const result = await quoteFieldDocument(input); if (result.error) { setError(result.error); return }; if (result.success) setReview({ input, total: result.total, amount: result.amount, lines: result.lines }) }
    catch { setError('Could not load current prices. Your entry is kept; retry.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <h2 className="text-xl font-semibold">{kind === 'order' ? 'How many cases?' : 'Quick invoice'}</h2>
    <fieldset disabled={pending} className="space-y-5">
      {kind === 'order' ? <div className="space-y-3">{products.map(product => <label key={product.id} className="flex items-center gap-3 rounded-2xl border bg-white p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{product.sku} · {product.bottlesPerCase} bottles/case</p></div><div className="w-24 shrink-0"><span className="text-xs">Cases</span><input name={`quantity-${product.id}`} aria-label={`${product.name} cases`} type="number" inputMode="numeric" min="0" max="10000" step="1" defaultValue="0" className="mt-1 h-14 w-full rounded-xl border px-3 text-xl" /></div></label>)}</div> : <>
        <label className="block">What is this invoice for?<input className={cls} name="description" required maxLength={200} placeholder="Products or services" /></label>
        <label className="block">Amount (USD)<input className={cls} name="amount" required type="number" inputMode="decimal" min="0.01" max="9999999.99" step="0.01" /></label>
      </>}
      <label className="block">Customer email (optional)<input className={cls} name="email" type="email" defaultValue={account.email} autoComplete="email" /></label>
      <div><p className="mb-2 font-medium">How will they pay?</p><div className="grid grid-cols-3 gap-2">{(['check', 'cod', 'stripe'] as const).map(value => <button key={value} type="button" aria-pressed={method === value} onClick={() => setMethod(value)} className={`min-h-16 rounded-xl border-2 p-2 text-base font-semibold ${method === value ? 'border-[#ff5a00] bg-orange-50' : 'border-stone-200 bg-white'}`}>{value === 'check' ? 'Check' : value === 'cod' ? 'COD' : 'Stripe card'}</button>)}</div><p className="mt-2 text-sm text-muted-foreground">{method === 'stripe' ? 'Secure card entry opens after the invoice saves. Processing fee is shown before charging.' : 'Selecting check or COD does not record a payment.'}</p></div>
      <details className="rounded-xl border bg-white p-4"><summary>Tax & notes (optional)</summary><div className="mt-3 space-y-3"><label className="block">Tax (USD)<input className={cls} name="tax" type="number" min="0" max="9999999.99" step="0.01" defaultValue="0" /></label><label className="block">Notes<textarea name="notes" maxLength={2000} className="mt-2 min-h-24 w-full rounded-xl border p-3 text-base" /></label></div></details>
    </fieldset>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}
    <Button className="h-14 w-full text-base" disabled={pending}>{pending ? 'Loading current prices…' : 'Review total'}</Button>
  </form></>
}
