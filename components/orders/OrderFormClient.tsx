'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { createOrder } from '@/actions/orders'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAYMENT_TERM_OPTIONS, formatPaymentTerms } from '@/lib/orders/payment-terms'
import { formatCurrency } from '@/lib/utils'

interface Product {
  id: string
  sku: string
  name: string
  price: string
  bottlePrice: string
  brand: string | null
  category: string | null
  bottlesPerCase: number
  quantityPaid: number | null
  looseBottlePaid: number | null
}

interface Customer {
  id: string
  companyName: string
  paymentTerms: string | null
}

type PurchaseUnit = 'case' | 'bottle'

interface LineItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

function getBottlePrice(product: Product) {
  const explicitBottlePrice = parseFloat(product.bottlePrice || '0')
  if (explicitBottlePrice > 0) return explicitBottlePrice
  const bottlesPerCase = product.bottlesPerCase || 12
  return parseFloat(product.price) / bottlesPerCase
}

function getBottleStock(product: Product) {
  const bottlesPerCase = product.bottlesPerCase || 12
  return (product.quantityPaid ?? 0) * bottlesPerCase - (product.looseBottlePaid ?? 0)
}

export default function OrderFormClient({
  customers,
  products,
  mode = 'staff',
}: {
  customers: Customer[]
  products: Product[]
  mode?: 'admin' | 'staff'
}) {
  const [customerId, setCustomerId] = useState('')
  const [purchaseUnit, setPurchaseUnit] = useState<PurchaseUnit>('case')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('NET30')

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null

  useEffect(() => {
    if (!selectedCustomer) {
      setPaymentTerms('NET30')
      return
    }
    setPaymentTerms(selectedCustomer.paymentTerms ?? 'NET30')
  }, [selectedCustomer])

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku.toLowerCase().includes(search.toLowerCase()) ||
    (product.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const addProduct = (product: Product) => {
    const price = purchaseUnit === 'bottle' ? getBottlePrice(product) : parseFloat(product.price)
    setLineItems(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: price }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setLineItems(prev => prev.filter(item => item.productId !== productId))
      return
    }

    setLineItems(prev => prev.map(item => item.productId === productId ? { ...item, quantity } : item))
  }

  const total = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  function updatePurchaseUnit(nextUnit: PurchaseUnit) {
    setPurchaseUnit(nextUnit)
    setLineItems(prev => prev.map(item => {
      const product = products.find(candidate => candidate.id === item.productId)
      if (!product) return item

      return {
        ...item,
        unitPrice: nextUnit === 'bottle' ? getBottlePrice(product) : parseFloat(product.price),
      }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formData = new FormData()
    formData.append('customerId', customerId)
    formData.append('purchaseUnit', purchaseUnit)
    formData.append('notes', notes)
    if (mode === 'admin') {
      formData.append('paymentTerms', paymentTerms)
    }
    formData.append('items', JSON.stringify(lineItems.map(item => ({ productId: item.productId, quantity: item.quantity }))))
    const result = await createOrder(formData)
    if (result?.error) {
      toast.error('Order creation failed', { description: result.error })
      return
    }
    toast.success('Order created')
    if (result?.redirectTo) {
      window.location.href = result.redirectTo
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Order Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select customer...</option>
                  {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}
                </select>
                {selectedCustomer ? (
                  <p className="text-xs text-muted-foreground">
                    Account default: {formatPaymentTerms(selectedCustomer.paymentTerms)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Purchase Unit</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={purchaseUnit === 'case' ? 'default' : 'outline'} onClick={() => updatePurchaseUnit('case')}>
                    Cases
                  </Button>
                  <Button type="button" size="sm" variant={purchaseUnit === 'bottle' ? 'default' : 'outline'} onClick={() => updatePurchaseUnit('bottle')}>
                    Bottles
                  </Button>
                </div>
              </div>

              {mode === 'admin' ? (
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <select
                    id="paymentTerms"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PAYMENT_TERM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added</p>
              ) : lineItems.map(item => (
                <div key={item.productId} className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unitPrice)} x {item.quantity} {purchaseUnit}{item.quantity === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="flex h-5 w-5 items-center justify-center rounded border hover:bg-slate-100">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="flex h-5 w-5 items-center justify-center rounded border hover:bg-slate-100">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => updateQuantity(item.productId, 0)} className="flex h-5 w-5 items-center justify-center hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <Button type="submit" className="mt-2 w-full" disabled={lineItems.length === 0 || !customerId}>
                Place Order
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredProducts.map(product => {
              const price = purchaseUnit === 'bottle' ? getBottlePrice(product) : parseFloat(product.price)
              const stock = purchaseUnit === 'bottle' ? getBottleStock(product) : (product.quantityPaid ?? 0)
              const inOrder = lineItems.find(item => item.productId === product.id)

              return (
                <Card
                  key={product.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => addProduct(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{product.name}</p>
                        {product.brand ? <p className="text-xs text-muted-foreground">{product.brand}</p> : null}
                        <p className="mt-0.5 text-xs text-muted-foreground">SKU: {product.sku}</p>
                        {purchaseUnit === 'bottle' ? (
                          <p className="mt-1 text-xs text-muted-foreground">{product.bottlesPerCase || 12} bottles per case</p>
                        ) : null}
                      </div>
                      {inOrder ? <Badge variant="info">{inOrder.quantity}</Badge> : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">{formatCurrency(price)} / {purchaseUnit}</span>
                      <span className={`text-xs ${(stock ?? 0) <= 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {stock ?? 0} {purchaseUnit}{stock === 1 ? '' : 's'} in stock
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </form>
  )
}
