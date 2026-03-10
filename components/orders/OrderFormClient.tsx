'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { createOrder } from '@/actions/orders'
import { Plus, Minus, Trash2 } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  price: string
  samplePrice: string
  brand: string | null
  category: string | null
  quantityPaid: number | null
  quantitySample: number | null
}

interface Customer {
  id: string
  companyName: string
}

interface LineItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export default function OrderFormClient({ customers, products }: { customers: Customer[]; products: Product[] }) {
  const [customerId, setCustomerId] = useState('')
  const [orderType, setOrderType] = useState<'paid' | 'sample'>('paid')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const addProduct = (product: Product) => {
    const price = parseFloat(orderType === 'sample' ? product.samplePrice : product.price)
    setLineItems(prev => {
      const existing = prev.find(li => li.productId === product.id)
      if (existing) return prev.map(li => li.productId === product.id ? { ...li, quantity: li.quantity + 1 } : li)
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: price }]
    })
  }

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) setLineItems(prev => prev.filter(li => li.productId !== productId))
    else setLineItems(prev => prev.map(li => li.productId === productId ? { ...li, quantity: qty } : li))
  }

  const total = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formData = new FormData()
    formData.append('customerId', customerId)
    formData.append('orderType', orderType)
    formData.append('notes', notes)
    formData.append('items', JSON.stringify(lineItems.map(li => ({ productId: li.productId, quantity: li.quantity }))))
    await createOrder(formData)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Order Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Order Type</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={orderType === 'paid' ? 'default' : 'outline'} onClick={() => setOrderType('paid')}>Paid Cases</Button>
                  <Button type="button" size="sm" variant={orderType === 'sample' ? 'default' : 'outline'} onClick={() => setOrderType('sample')}>Sample Cases</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions..." />
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader><CardTitle className="text-base">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added</p>
              ) : lineItems.map(li => (
                <div key={li.productId} className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium">{li.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(li.unitPrice)} × {li.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQuantity(li.productId, li.quantity - 1)} className="w-5 h-5 rounded border flex items-center justify-center hover:bg-slate-100"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs w-5 text-center">{li.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(li.productId, li.quantity + 1)} className="w-5 h-5 rounded border flex items-center justify-center hover:bg-slate-100"><Plus className="w-3 h-3" /></button>
                    <button type="button" onClick={() => updateQuantity(li.productId, 0)} className="w-5 h-5 flex items-center justify-center hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={lineItems.length === 0 || !customerId}>
                Place Order
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Product Catalog */}
        <div className="lg:col-span-2 space-y-4">
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProducts.map(product => {
              const price = parseFloat(orderType === 'sample' ? product.samplePrice : product.price)
              const stock = orderType === 'sample' ? product.quantitySample : product.quantityPaid
              const inOrder = lineItems.find(li => li.productId === product.id)
              return (
                <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => addProduct(product)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product.name}</p>
                        {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">SKU: {product.sku}</p>
                      </div>
                      {inOrder && <Badge variant="info">{inOrder.quantity}</Badge>}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-semibold text-sm">{formatCurrency(price)}</span>
                      <span className={`text-xs ${(stock ?? 0) <= 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {stock ?? 0} in stock
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
