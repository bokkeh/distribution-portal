'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createInvoice } from '@/actions/invoices'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GeographicPricingRuleInput } from '@/lib/pricing/geographic'
import { resolveProductUnitPrice } from '@/lib/pricing/product-price'

type CustomerOption = {
  id: string
  companyName: string
  state: string | null
  county: string | null
}

type OrderOption = {
  id: string
  total: string
  customerId: string
}

type ProductOption = {
  id: string
  name: string
  sku: string
  price: string
  bottlePrice: string
  bottlesPerCase: number | null
  defaultUnit: string
}

type LineItemFormRow = {
  key: string
  productId: string
  description: string
  sku: string
  quantity: string
  unit: 'case' | 'bottle'
  unitPrice: string
}

function createEmptyRow(): LineItemFormRow {
  return {
    key: crypto.randomUUID(),
    productId: '',
    description: '',
    sku: '',
    quantity: '1',
    unit: 'case',
    unitPrice: '0.00',
  }
}

function toAmount(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function AdminInvoiceCreateForm({
  customers,
  orders,
  products,
  pricingRules,
}: {
  customers: CustomerOption[]
  orders: OrderOption[]
  products: ProductOption[]
  pricingRules: GeographicPricingRuleInput[]
}) {
  const [customerId, setCustomerId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [tax, setTax] = useState('0')
  const [lineItems, setLineItems] = useState<LineItemFormRow[]>([createEmptyRow()])

  const isDirectInvoice = !orderId

  const availableOrders = useMemo(
    () => orders.filter((order) => !customerId || order.customerId === customerId),
    [customerId, orders],
  )

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + toAmount(item.quantity) * toAmount(item.unitPrice), 0),
    [lineItems],
  )

  useEffect(() => {
    if (orderId && !availableOrders.some((order) => order.id === orderId)) {
      setOrderId('')
    }
  }, [availableOrders, orderId])

  const updateRow = (key: string, updater: (row: LineItemFormRow) => LineItemFormRow) => {
    setLineItems((current) => current.map((row) => (row.key === key ? updater(row) : row)))
  }

  const getAccountContext = (selectedCustomerId: string) => {
    const customer = customers.find((item) => item.id === selectedCustomerId)
    return {
      state: customer?.state ?? null,
      county: customer?.county ?? null,
    }
  }

  const getResolvedUnitPrice = (product: ProductOption, unit: 'case' | 'bottle', quantity: string, selectedCustomerId: string) => {
    const resolved = resolveProductUnitPrice({
      product,
      account: getAccountContext(selectedCustomerId),
      rules: pricingRules,
      purchaseUnit: unit,
      quantity: toAmount(quantity) || 1,
      asOf: new Date(),
    })

    return resolved.unitPrice.toFixed(2)
  }

  const handleProductChange = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId)

    updateRow(key, (row) => {
      if (!product) {
        return { ...row, productId: '', description: '', sku: '', unitPrice: '0.00' }
      }

      const unit = row.unit === 'bottle' || product.defaultUnit === 'bottle' ? 'bottle' : 'case'

      return {
        ...row,
        productId: product.id,
        description: product.name,
        sku: product.sku,
        unit,
        unitPrice: getResolvedUnitPrice(product, unit, row.quantity, customerId),
      }
    })
  }

  const handleUnitChange = (key: string, unit: 'case' | 'bottle') => {
    updateRow(key, (row) => {
      const product = products.find((item) => item.id === row.productId)

      return {
        ...row,
        unit,
        unitPrice: product ? getResolvedUnitPrice(product, unit, row.quantity, customerId) : row.unitPrice,
      }
    })
  }

  useEffect(() => {
    setLineItems((current) => current.map((row) => {
      const product = products.find((item) => item.id === row.productId)
      if (!product) return row

      return {
        ...row,
        unitPrice: getResolvedUnitPrice(product, row.unit, row.quantity, customerId),
      }
    }))
  }, [customerId, pricingRules, products])

  return (
    <form action={createInvoice} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        <select
          name="customerId"
          id="customerId"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select customer...</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.companyName}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="orderId">Linked Order (optional)</Label>
        <select
          name="orderId"
          id="orderId"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">No linked order</option>
          {availableOrders.map((order) => (
            <option key={order.id} value={order.id}>
              Order #{order.id.slice(-8).toUpperCase()} - ${order.total}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Only fulfilled orders without an existing invoice are listed.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Products</h3>
            <p className="text-xs text-muted-foreground">
              {isDirectInvoice
                ? 'Add products for a direct invoice. Subtotal is calculated from these rows.'
                : 'Linked orders use the order’s products automatically.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isDirectInvoice}
            onClick={() => setLineItems((current) => [...current, createEmptyRow()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        <div className="space-y-3">
          {lineItems.map((item, index) => {
            const lineTotal = toAmount(item.quantity) * toAmount(item.unitPrice)

            return (
              <div key={item.key} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_90px_110px_120px_auto]">
                <div className="space-y-2">
                  <Label htmlFor={`product-${item.key}`}>Product</Label>
                  <select
                    id={`product-${item.key}`}
                    name="lineItemProductId"
                    disabled={!isDirectInvoice}
                    value={item.productId}
                    onChange={(event) => handleProductChange(item.key, event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${item.key}`}>Description</Label>
                  <Input
                    id={`description-${item.key}`}
                    name="lineItemDescription"
                    value={item.description}
                    disabled={!isDirectInvoice}
                    onChange={(event) => updateRow(item.key, (row) => ({ ...row, description: event.target.value }))}
                    placeholder="Product description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`qty-${item.key}`}>Qty</Label>
                  <Input
                    id={`qty-${item.key}`}
                    type="number"
                    name="lineItemQuantity"
                    min="0.01"
                    step="0.01"
                    disabled={!isDirectInvoice}
                    value={item.quantity}
                    onChange={(event) => updateRow(item.key, (row) => {
                      const nextQuantity = event.target.value
                      const product = products.find((entry) => entry.id === row.productId)
                      return {
                        ...row,
                        quantity: nextQuantity,
                        unitPrice: product ? getResolvedUnitPrice(product, row.unit, nextQuantity, customerId) : row.unitPrice,
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`unit-${item.key}`}>Unit</Label>
                  <select
                    id={`unit-${item.key}`}
                    name="lineItemUnit"
                    disabled={!isDirectInvoice}
                    value={item.unit}
                    onChange={(event) => handleUnitChange(item.key, event.target.value as 'case' | 'bottle')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="case">Case</option>
                    <option value="bottle">Bottle</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`unit-price-${item.key}`}>Unit Price</Label>
                  <Input
                    id={`unit-price-${item.key}`}
                    type="number"
                    name="lineItemUnitPrice"
                    min="0"
                    step="0.01"
                    disabled={!isDirectInvoice}
                    value={item.unitPrice}
                    onChange={(event) => updateRow(item.key, (row) => ({ ...row, unitPrice: event.target.value }))}
                  />
                </div>

                <div className="flex items-end justify-between gap-3 lg:justify-end">
                  <input type="hidden" name="lineItemSku" value={item.sku} />
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Line Total</p>
                    <p className="text-sm font-semibold text-slate-900">${lineTotal.toFixed(2)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!isDirectInvoice || lineItems.length === 1}
                    onClick={() => setLineItems((current) => current.filter((row) => row.key !== item.key))}
                    aria-label={`Remove product row ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ($)</Label>
          <Input
            type="number"
            name="amount"
            id="amount"
            step="0.01"
            min="0"
            readOnly
            value={isDirectInvoice ? subtotal.toFixed(2) : ''}
            placeholder={isDirectInvoice ? 'Calculated from products' : 'Calculated from linked order'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax">Tax ($)</Label>
          <Input
            type="number"
            name="tax"
            id="tax"
            step="0.01"
            min="0"
            value={tax}
            onChange={(event) => setTax(event.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Linking a fulfilled order uses that order&apos;s products, subtotal, and tax. Leave the order blank to build a direct invoice with product rows.
      </p>

      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input type="date" name="dueDate" id="dueDate" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit">Create Invoice</Button>
        <Link href="/admin/invoicing" className={buttonVariants({ variant: 'outline' })}>Cancel</Link>
      </div>
    </form>
  )
}
