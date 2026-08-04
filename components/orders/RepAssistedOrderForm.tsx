'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Save, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveRepAssistedOrderDraft, submitRepAssistedOrder } from '@/actions/rep-assisted-orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'

type Customer = {
  id: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  paymentTerms: string | null
  hubspotCompanyId: string | null
  dcAbraNumber: string | null
}

type Product = { id: string; sku: string; name: string; price: string; quantityPaid: number | null }
type Line = { productId: string; quantity: number }
type InitialDraft = Partial<{
  idempotencyKey: string; accountMode: 'existing' | 'new'; customerId: string; companyName: string; businessType: string;
  contactName: string; contactTitle: string; email: string; phone: string; address: string; city: string; state: string; zip: string;
  lines: Line[]; discountPercent: number; shipping: number; tax: number; purchaseOrderNumber: string; requestedDeliveryDate: string;
  billingAddress: string; shippingAddress: string; customerFacingNotes: string; internalNotes: string;
}>

export function RepAssistedOrderForm({ customers, products, initialDraft }: { customers: Customer[]; products: Product[]; initialDraft?: InitialDraft }) {
  const [isPending, startTransition] = useTransition()
  const [accountMode, setAccountMode] = useState<'existing' | 'new'>(initialDraft?.accountMode ?? 'existing')
  const [customerId, setCustomerId] = useState(initialDraft?.customerId ?? '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<Line[]>(initialDraft?.lines ?? [])
  const [discountPercent, setDiscountPercent] = useState(initialDraft?.discountPercent ?? 0)
  const [shipping, setShipping] = useState(initialDraft?.shipping ?? 0)
  const [tax, setTax] = useState(initialDraft?.tax ?? 0)
  const [idempotencyKey] = useState(() => initialDraft?.idempotencyKey ?? crypto.randomUUID())

  const selectedCustomer = customers.find((customer) => customer.id === customerId)
  const matchingCustomers = useMemo(() => {
    const query = customerSearch.toLowerCase().trim()
    if (!query) return customers.slice(0, 12)
    return customers.filter((customer) => [
      customer.companyName, customer.contactName, customer.email, customer.phone,
      customer.hubspotCompanyId, customer.dcAbraNumber,
    ].some((value) => value?.toLowerCase().includes(query))).slice(0, 20)
  }, [customerSearch, customers])
  const matchingProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim()
    return products.filter((product) => !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)).slice(0, 20)
  }, [productSearch, products])

  const subtotal = lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId)
    return sum + Number(product?.price ?? 0) * line.quantity
  }, 0)
  const estimatedTotal = Math.max(0, subtotal - subtotal * discountPercent / 100 + shipping + tax)

  function addProduct(productId: string) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId)
      return existing
        ? current.map((line) => line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { productId, quantity: 1 }]
    })
  }

  function buildFormData(form: HTMLFormElement) {
    const data = new FormData(form)
    data.set('accountMode', accountMode)
    data.set('customerId', customerId)
    data.set('items', JSON.stringify(lines))
    data.set('discountPercent', String(discountPercent))
    data.set('shipping', String(shipping))
    data.set('tax', String(tax))
    data.set('idempotencyKey', idempotencyKey)
    if (selectedCustomer && accountMode === 'existing') {
      data.set('email', String(data.get('email') || selectedCustomer.email || ''))
      data.set('phone', String(data.get('phone') || selectedCustomer.phone || ''))
      data.set('paymentTerms', selectedCustomer.paymentTerms ?? 'PREPAID')
    }
    return data
  }

  function run(form: HTMLFormElement, mode: 'draft' | 'submit') {
    startTransition(async () => {
      const result = mode === 'draft'
        ? await saveRepAssistedOrderDraft(buildFormData(form))
        : await submitRepAssistedOrder(buildFormData(form))
      if (result.error) {
        toast.error(mode === 'draft' ? 'Draft not saved' : 'Order not submitted', { description: result.error })
        return
      }
      if (mode === 'draft') toast.success('Draft saved')
      else if ('redirectTo' in result && result.redirectTo) window.location.href = result.redirectTo
    })
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); run(event.currentTarget, 'submit') }} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. Find or create customer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant={accountMode === 'existing' ? 'default' : 'outline'} onClick={() => setAccountMode('existing')}>Existing account</Button>
            <Button type="button" variant={accountMode === 'new' ? 'default' : 'outline'} onClick={() => setAccountMode('new')}>New account</Button>
          </div>
          {accountMode === 'existing' ? (
            <div className="space-y-3">
              <Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search business, contact, email, phone, CRM ID, or account number" />
              <div className="grid gap-2 md:grid-cols-2">
                {matchingCustomers.map((customer) => (
                  <button key={customer.id} type="button" onClick={() => setCustomerId(customer.id)} className={`rounded-xl border p-3 text-left ${customerId === customer.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    <p className="font-semibold text-slate-900">{customer.companyName}</p>
                    <p className="text-xs text-slate-500">{customer.contactName || 'No primary contact'} · {customer.email || 'No email'}</p>
                    <p className="text-xs text-slate-500">{[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || 'No address'}</p>
                  </button>
                ))}
              </div>
              {selectedCustomer ? <Badge variant="success">Selected: {selectedCustomer.companyName}</Badge> : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Legal business name" name="companyName" defaultValue={initialDraft?.companyName} required />
              <Field label="Business type" name="businessType" defaultValue={initialDraft?.businessType} />
              <Field label="Primary contact" name="contactName" defaultValue={initialDraft?.contactName} required />
              <Field label="Contact title" name="contactTitle" defaultValue={initialDraft?.contactTitle} />
              <Field label="Business address" name="address" defaultValue={initialDraft?.address} />
              <Field label="City" name="city" defaultValue={initialDraft?.city} />
              <Field label="State" name="state" defaultValue={initialDraft?.state} />
              <Field label="ZIP" name="zip" defaultValue={initialDraft?.zip} />
              <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Similar company names or email addresses will be blocked at submission so an existing CRM account can be selected instead.
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Notification email" name="email" type="email" defaultValue={initialDraft?.email ?? selectedCustomer?.email ?? ''} required />
            <Field label="Notification mobile" name="phone" type="tel" defaultValue={initialDraft?.phone ?? selectedCustomer?.phone ?? ''} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Build order</CardTitle></CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products or SKUs" />
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {matchingProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => addProduct(product.id)} disabled={(product.quantityPaid ?? 0) <= 0} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left disabled:opacity-50">
                  <div><p className="font-medium">{product.name}</p><p className="text-xs text-slate-500">{product.sku} · {product.quantityPaid ?? 0} cases available</p></div>
                  <div className="flex items-center gap-2"><span className="font-semibold">{formatCurrency(Number(product.price))}</span><Plus className="h-4 w-4" /></div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {lines.map((line) => {
              const product = products.find((item) => item.id === line.productId)!
              return (
                <div key={line.productId} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="flex-1"><p className="font-medium">{product.name}</p><p className="text-xs text-slate-500">{formatCurrency(Number(product.price))} each</p></div>
                  <Input className="w-20" type="number" min={1} value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.productId === line.productId ? { ...item, quantity: Number(event.target.value) } : item))} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )
            })}
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Discount %" value={discountPercent} onChange={setDiscountPercent} />
              <NumberField label="Shipping" value={shipping} onChange={setShipping} />
              <NumberField label="Tax" value={tax} onChange={setTax} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purchase order number" name="purchaseOrderNumber" defaultValue={initialDraft?.purchaseOrderNumber} />
              <Field label="Requested delivery date" name="requestedDeliveryDate" type="date" defaultValue={initialDraft?.requestedDeliveryDate} />
              <Field label="Billing address" name="billingAddress" defaultValue={initialDraft?.billingAddress} />
              <Field label="Shipping address" name="shippingAddress" defaultValue={initialDraft?.shippingAddress} />
            </div>
            <label className="block space-y-1"><span className="text-sm font-medium">Customer-facing notes</span><textarea name="customerFacingNotes" defaultValue={initialDraft?.customerFacingNotes} className="min-h-20 w-full rounded-md border p-3 text-sm" /></label>
            <label className="block space-y-1"><span className="text-sm font-medium">Internal notes</span><textarea name="internalNotes" defaultValue={initialDraft?.internalNotes} className="min-h-20 w-full rounded-md border p-3 text-sm" /></label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Review and submit</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Summary label="Products subtotal" value={formatCurrency(subtotal)} />
          <Summary label={`Discount (${discountPercent}%)`} value={`-${formatCurrency(subtotal * discountPercent / 100)}`} />
          <Summary label="Shipping" value={formatCurrency(shipping)} />
          <Summary label="Tax" value={formatCurrency(tax)} />
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Estimated total</span><span>{formatCurrency(estimatedTotal)}</span></div>
          <p className="text-xs text-slate-500">Server-side pricing and inventory are checked again before the order and invoice are created.</p>
          <div className="flex flex-wrap justify-end gap-2 pt-3">
            <Button type="button" variant="outline" disabled={isPending} onClick={(event) => run(event.currentTarget.form!, 'draft')}><Save className="mr-2 h-4 w-4" />Save draft</Button>
            <Button type="submit" disabled={isPending || !lines.length || (accountMode === 'existing' && !customerId)}><Send className="mr-2 h-4 w-4" />{isPending ? 'Submitting…' : 'Submit and notify customer'}</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function Field({ label, name, type = 'text', required, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} /></div>
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><Input type="number" min={0} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-medium">{value}</span></div>
}
