'use client'

import { useCart } from '@/hooks/useCart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { resolveGeographicCasePrice, type GeographicPricingRuleInput } from '@/lib/pricing/geographic'
import { formatOrderTypeLabel } from '@/lib/orders/status'

function getDisplayedPrice(
  item: { productId: string; price: string; samplePrice: string; quantity: number },
  orderType: 'paid' | 'sample',
  pricingRules: GeographicPricingRuleInput[],
  pricingAccountId: string | null,
  pricingBusinessType: string | null,
  pricingState: string | null,
  pricingCounty: string | null
) {
  if (orderType === 'sample') return parseFloat(item.samplePrice)
  return resolveGeographicCasePrice({
    productId: item.productId,
    baseCasePrice: item.price,
    accountId: pricingAccountId,
    businessType: pricingBusinessType,
    state: pricingState,
    county: pricingCounty,
    rules: pricingRules,
    asOf: new Date(),
    quantityCases: item.quantity,
  }).price
}

export default function CustomerCartPage({
  pricingRules,
  pricingAccountId,
  pricingBusinessType,
  pricingState,
  pricingCounty,
}: {
  pricingRules: GeographicPricingRuleInput[]
  pricingAccountId: string | null
  pricingBusinessType: string | null
  pricingState: string | null
  pricingCounty: string | null
}) {
  const { items, orderType, removeItem, updateQuantity, clearCart, itemCount } = useCart()
  const displayedTotal = items.reduce((sum, item) => sum + getDisplayedPrice(item, orderType, pricingRules, pricingAccountId, pricingBusinessType, pricingState, pricingCounty) * item.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <ShoppingCart className="mx-auto h-16 w-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-900">Your cart is empty</h2>
        <p className="text-muted-foreground">Browse our catalog and add products to your order.</p>
        <Link href="/customer/products"><Button>Browse Products</Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Cart</h1>
          <p className="mt-1 text-muted-foreground">{itemCount()} item(s) · <Badge variant="outline">{formatOrderTypeLabel(orderType)}</Badge></p>
        </div>
        <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700">Clear cart</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map(item => {
            const price = getDisplayedPrice(item, orderType, pricingRules, pricingAccountId, pricingBusinessType, pricingState, pricingCounty)

            return (
              <Card key={item.productId}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded border hover:bg-slate-100"
                        title="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded border hover:bg-slate-100">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="w-20 text-right">
                      <p className="font-semibold">{formatCurrency(price * item.quantity)}</p>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="sticky top-4 h-fit">
          <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {items.map(item => {
                const price = getDisplayedPrice(item, orderType, pricingRules, pricingAccountId, pricingBusinessType, pricingState, pricingCounty)
                return (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.name} x{item.quantity}</span>
                    <span>{formatCurrency(price * item.quantity)}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>Total</span><span>{formatCurrency(displayedTotal)}</span>
            </div>
            <Link href="/customer/checkout">
              <Button className="w-full">
                Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/customer/products">
              <Button variant="outline" className="w-full">Continue Shopping</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
