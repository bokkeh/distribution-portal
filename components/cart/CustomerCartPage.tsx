'use client'

import { useCart } from '@/hooks/useCart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function CustomerCartPage() {
  const { items, orderType, removeItem, updateQuantity, clearCart, total, itemCount } = useCart()

  if (items.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <ShoppingCart className="w-16 h-16 mx-auto text-slate-300" />
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
          <p className="text-muted-foreground mt-1">{itemCount()} item(s) · <Badge variant="outline">{orderType} order</Badge></p>
        </div>
        <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700">Clear cart</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => {
            const price = parseFloat(orderType === 'sample' ? item.samplePrice : item.price)
            return (
              <Card key={item.productId}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} width={64} height={64} className="object-cover" /> : <span className="text-2xl">🍷</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(price)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-7 h-7 border rounded flex items-center justify-center hover:bg-slate-100">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-7 h-7 border rounded flex items-center justify-center hover:bg-slate-100">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="w-20 text-right">
                    <p className="font-semibold">{formatCurrency(price * item.quantity)}</p>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="h-fit sticky top-4">
          <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {items.map(item => {
                const price = parseFloat(orderType === 'sample' ? item.samplePrice : item.price)
                return (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.name} ×{item.quantity}</span>
                    <span>{formatCurrency(price * item.quantity)}</span>
                  </div>
                )
              })}
            </div>
            <div className="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total</span><span>{formatCurrency(total())}</span>
            </div>
            <Link href="/customer/checkout">
              <Button className="w-full">
                Proceed to Checkout <ArrowRight className="w-4 h-4 ml-2" />
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
